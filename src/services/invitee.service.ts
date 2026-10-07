import { Types } from 'mongoose';
import type { z } from 'zod';
import type { QrType } from '../constants/options';
import type { EventDoc } from '../models/Event.model';
import { InviteeModel } from '../models/Invitee.model';
import type { UserDoc } from '../models/User.model';
import { conflict, notFound } from '../utils/AppError';
import { escapeRegex } from '../utils/format';
import { buildQrPayload, generateTicketCode } from '../utils/qr';
import type { inviteeInputSchema, updateInviteeSchema } from '../validators/invitee.schema';
import { getManagedEvent, scopedEventIds } from './access.service';

type InviteeInput = z.infer<typeof inviteeInputSchema>;

/** `count` ticket codes that are unique among themselves and in the database. */
const uniqueTicketCodes = async (count: number) => {
  const codes = new Set<string>();
  while (codes.size < count) {
    const batch = new Set<string>();
    while (batch.size < count - codes.size) {
      const code = generateTicketCode();
      if (!codes.has(code)) batch.add(code);
    }
    const taken = await InviteeModel.find({ ticketCode: { $in: [...batch] } }).distinct('ticketCode');
    for (const code of batch) if (!taken.includes(code)) codes.add(code);
  }
  return [...codes];
};

const ticketFor = (eventId: Types.ObjectId, inviteeId: Types.ObjectId, ticketCode: string, qrType: QrType) => ({
  ticketCode,
  qrType,
  qrPayload: buildQrPayload(qrType, { ticketCode, eventId: String(eventId), inviteeId: String(inviteeId) }),
});

/** The event's QR style is fixed by the first import; later guests reuse it. */
const lockQrType = async (event: EventDoc, requested: QrType) => {
  if (!event.qrType) {
    event.qrType = requested;
    await event.save();
  }
  return event.qrType as QrType;
};

export interface ImportResult {
  created: number;
  skipped: { email: string; reason: string }[];
}

export const importInvitees = async (event: EventDoc, rows: InviteeInput[], qrType: QrType): Promise<ImportResult> => {
  const skipped: ImportResult['skipped'] = [];
  const invited = new Set(
    await InviteeModel.find({ eventId: event._id, email: { $in: rows.map((r) => r.email) } }).distinct('email'),
  );
  const seen = new Set<string>();

  const fresh: InviteeInput[] = [];
  for (const row of rows) {
    if (invited.has(row.email)) skipped.push({ email: row.email, reason: 'Already invited' });
    else if (seen.has(row.email)) skipped.push({ email: row.email, reason: 'Duplicate in file' });
    else fresh.push(row);
    seen.add(row.email);
  }
  if (!fresh.length) return { created: 0, skipped };

  const type = await lockQrType(event, qrType);
  const codes = await uniqueTicketCodes(fresh.length);
  const docs = fresh.map((row, i) => {
    const _id = new Types.ObjectId();
    return { _id, eventId: event._id, ...row, ...ticketFor(event._id, _id, codes[i]!, type) };
  });
  await InviteeModel.insertMany(docs);
  return { created: docs.length, skipped };
};

export const addInvitee = async (event: EventDoc, input: InviteeInput) => {
  if (await InviteeModel.exists({ eventId: event._id, email: input.email })) {
    throw conflict('This email is already invited to the event');
  }
  const type = await lockQrType(event, 'standard');
  const [code] = await uniqueTicketCodes(1);
  const _id = new Types.ObjectId();
  return InviteeModel.create({ _id, eventId: event._id, ...input, ...ticketFor(event._id, _id, code!, type) });
};

interface ListFilters {
  eventId?: string;
  q?: string;
  checkIn?: string;
  emailStatus?: string;
}

/** Guests across every event the user can see (or one event). */
export const listInvitees = async (actor: UserDoc, { eventId, q, checkIn, emailStatus }: ListFilters) => {
  const allowed = await scopedEventIds(actor);
  const filter: Record<string, unknown> = {};

  if (eventId) {
    if (allowed && !allowed.some((id) => id.equals(eventId))) throw notFound('Event not found');
    filter.eventId = eventId;
  } else if (allowed) {
    filter.eventId = { $in: allowed };
  }
  if (checkIn) filter.checkIn = checkIn;
  if (emailStatus) filter.emailStatus = emailStatus;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { email: re }, { company: re }, { ticketCode: re }];
  }

  return InviteeModel.find(filter).sort({ createdAt: -1 }).populate('checkedInBy', 'name email');
};

/** Loads an invitee whose event the actor manages. */
export const getManagedInvitee = async (actor: UserDoc, inviteeId: string) => {
  const invitee = await InviteeModel.findById(inviteeId);
  if (!invitee) throw notFound('Guest not found');
  await getManagedEvent(actor, String(invitee.eventId));
  return invitee;
};

export const updateInvitee = async (
  actor: UserDoc,
  inviteeId: string,
  input: z.infer<typeof updateInviteeSchema>,
) => {
  const invitee = await getManagedInvitee(actor, inviteeId);
  const { checkIn, ...rest } = input;

  if (rest.email && rest.email !== invitee.email) {
    if (await InviteeModel.exists({ eventId: invitee.eventId, email: rest.email })) {
      throw conflict('This email is already invited to the event');
    }
  }
  invitee.set(rest);

  // Manual check-in / undo from the planner's guest list.
  if (checkIn && checkIn !== invitee.checkIn) {
    invitee.checkIn = checkIn;
    invitee.checkedInAt = checkIn === 'checked_in' ? new Date() : null;
    invitee.checkedInBy = checkIn === 'checked_in' ? actor._id : null;
  }
  await invitee.save();
  return invitee.populate('checkedInBy', 'name email');
};

/** Deletes only guests belonging to events the actor manages; returns how many were removed. */
export const deleteInvitees = async (actor: UserDoc, ids: string[]) => {
  const allowed = await scopedEventIds(actor);
  const filter: Record<string, unknown> = { _id: { $in: ids } };
  if (allowed) filter.eventId = { $in: allowed };
  const { deletedCount } = await InviteeModel.deleteMany(filter);
  return deletedCount;
};

/** New ticket codes and QR payloads for every guest; previously sent QR codes stop working. */
export const regenerateQrCodes = async (event: EventDoc, qrType: QrType) => {
  event.qrType = qrType;
  await event.save();

  const invitees = await InviteeModel.find({ eventId: event._id }).select('_id');
  const codes = await uniqueTicketCodes(invitees.length);
  if (invitees.length) {
    await InviteeModel.bulkWrite(
      invitees.map((inv, i) => ({
        updateOne: { filter: { _id: inv._id }, update: { $set: ticketFor(event._id, inv._id, codes[i]!, qrType) } },
      })),
    );
  }
  return invitees.length;
};
