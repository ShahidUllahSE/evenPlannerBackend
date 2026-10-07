import type { z } from 'zod';
import type { EventDoc } from '../models/Event.model';
import { InviteeModel, type InviteeDoc } from '../models/Invitee.model';
import type { UserDoc } from '../models/User.model';
import { badRequest } from '../utils/AppError';
import { formatDate, formatTime } from '../utils/format';
import { buildQrMediaUrl } from '../utils/qr';
import type { sendSmsSchema } from '../validators/sms.schema';
import { normalizeSmsPhone, requireTwilioCredentials, sendSms } from './twilio.service';

const CONCURRENCY = 3;

const fillSms = (template: string, vars: Record<string, string>) =>
  template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    vars[key] !== undefined ? vars[key]! : match,
  );

const buildVars = (event: EventDoc, guest: InviteeDoc) => ({
  name: guest.name,
  eventTitle: event.title,
  eventDate: formatDate(event.date),
  eventTime: `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`,
  address: event.address || [event.venue, event.city].filter(Boolean).join(', '),
  ticketCode: guest.ticketCode,
  organizer: event.organizer || 'The organizers',
});

const runPool = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>) => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]!);
  });
  await Promise.all(lanes);
};

/** Send SMS/MMS invitations; optionally attach each guest’s QR PNG (same idea as email). */
export const sendSmsInvitations = async (
  _actor: UserDoc,
  event: EventDoc,
  input: z.infer<typeof sendSmsSchema>,
) => {
  await requireTwilioCredentials();

  const guests = await InviteeModel.find({ _id: { $in: input.inviteeIds }, eventId: event._id });
  if (!guests.length) throw badRequest('None of the selected guests belong to this event');

  const sent: string[] = [];
  const failed: { inviteeId: string; phone: string; error: string }[] = [];

  await runPool(guests, CONCURRENCY, async (guest) => {
    const phone = normalizeSmsPhone(guest.phone ?? '');
    if (!phone) {
      failed.push({
        inviteeId: guest.id,
        phone: guest.phone || '',
        error: 'Guest needs a phone in E.164 format (e.g. +14155552671)',
      });
      return;
    }

    try {
      const body = fillSms(input.message, buildVars(event, guest));
      const mediaUrls = input.includeQr ? [buildQrMediaUrl(guest.id)] : undefined;
      await sendSms(phone, body, mediaUrls);
      sent.push(guest.id);
    } catch (err) {
      failed.push({
        inviteeId: guest.id,
        phone,
        error: (err as Error).message || 'SMS failed',
      });
    }
  });

  return { sent: sent.length, failed };
};
