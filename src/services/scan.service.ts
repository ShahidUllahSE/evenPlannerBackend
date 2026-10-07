import { SCANNABLE_EVENT_STATUSES, type EventStatus, type ScanResult } from '../constants/options';
import { InviteeModel, type InviteeDoc } from '../models/Invitee.model';
import { ScanLogModel } from '../models/ScanLog.model';
import type { UserDoc } from '../models/User.model';
import { parseQrPayload, verifySignature } from '../utils/qr';
import { getVisibleEvent } from './access.service';

const MESSAGES: Record<ScanResult, string> = {
  valid: 'Ticket accepted. Welcome!',
  already_used: 'This ticket has already been used',
  invalid: 'Invalid or unrecognised ticket',
  wrong_event: 'This ticket is for a different event',
  event_closed: 'Check-in is not open for this event',
};

interface ScanMeta {
  ip?: string;
  userAgent?: string;
}

const guestSummary = (inv: InviteeDoc) => ({
  id: inv.id,
  name: inv.name,
  email: inv.email,
  company: inv.company,
  category: inv.category,
  ticketCode: inv.ticketCode,
});

/** Signature, event id and invitee id in the QR (when present) must match the stored ticket. */
const matchesTicket = (parsed: NonNullable<ReturnType<typeof parseQrPayload>>, invitee: InviteeDoc) => {
  const eventId = String(invitee.eventId);
  if (parsed.eventId && parsed.eventId !== eventId) return false;
  if (parsed.inviteeId && parsed.inviteeId !== invitee.id) return false;
  if (parsed.signature) {
    return verifySignature({ ticketCode: invitee.ticketCode, eventId, inviteeId: invitee.id }, parsed.signature);
  }
  return true;
};

/**
 * Validates a scanned QR for the chosen event and, if valid, marks the ticket used.
 * Every attempt is written to the scan log.
 */
export const scanTicket = async (actor: UserDoc, eventId: string, payload: string, meta: ScanMeta) => {
  // Scanners only see events they are assigned to; planners their own; admin all.
  const event = await getVisibleEvent(actor, eventId);

  const parsed = parseQrPayload(payload);
  let invitee = parsed ? await InviteeModel.findOne({ ticketCode: parsed.ticketCode }) : null;

  let result: ScanResult;
  if (!parsed || !invitee || !matchesTicket(parsed, invitee)) {
    result = 'invalid';
  } else if (!invitee.eventId.equals(event._id)) {
    result = 'wrong_event';
  } else if (!SCANNABLE_EVENT_STATUSES.includes(event.status as EventStatus)) {
    result = 'event_closed';
  } else {
    // Atomic: only one scanner can flip an unused ticket to used, even if two scan at once.
    const updated = await InviteeModel.findOneAndUpdate(
      { _id: invitee._id, checkIn: 'not_checked_in' },
      { $set: { checkIn: 'checked_in', checkedInAt: new Date(), checkedInBy: actor._id } },
      { returnDocument: 'after' },
    );
    result = updated ? 'valid' : 'already_used';
    invitee = updated ?? (await InviteeModel.findById(invitee._id));
  }

  // Only reveal guest details for tickets that belong to this event.
  const guest = result === 'valid' || result === 'already_used' || result === 'event_closed' ? invitee : null;

  await ScanLogModel.create({
    eventId: event._id,
    plannerId: event.createdBy,
    scannerId: actor._id,
    inviteeId: result === 'invalid' ? null : (invitee?._id ?? null),
    ticketCode: parsed?.ticketCode ?? null,
    result,
    rawPayload: payload.slice(0, 500),
    ip: meta.ip ?? null,
    userAgent: meta.userAgent?.slice(0, 300) ?? null,
  });

  if (guest) await guest.populate('checkedInBy', 'name email');

  return {
    valid: result === 'valid',
    result,
    message: MESSAGES[result],
    event: { id: event.id, title: event.title },
    guest: guest ? guestSummary(guest) : null,
    checkedInAt: guest?.checkedInAt ?? null,
    checkedInBy: guest?.checkedInBy ?? null,
  };
};

interface ScanLogFilters {
  eventId?: string;
  scannerId?: string;
  result?: string;
  page: number;
  limit: number;
}

/** Scan history: admin sees all, planner their events, scanner only their own scans. */
export const listScanLogs = async (actor: UserDoc, { eventId, scannerId, result, page, limit }: ScanLogFilters) => {
  const filter: Record<string, unknown> = {};
  if (actor.role === 'planner') filter.plannerId = actor._id;
  if (actor.role === 'scanner') filter.scannerId = actor._id;
  if (eventId) filter.eventId = eventId;
  if (scannerId && actor.role !== 'scanner') filter.scannerId = scannerId;
  if (result) filter.result = result;

  const [items, total] = await Promise.all([
    ScanLogModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('scannerId', 'name email')
      .populate('inviteeId', 'name email ticketCode category')
      .populate('eventId', 'title date'),
    ScanLogModel.countDocuments(filter),
  ]);
  return { items, total, page, limit };
};
