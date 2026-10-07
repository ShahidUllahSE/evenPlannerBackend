import type { z } from 'zod';
import type { QrType } from '../constants/options';
import { EmailLogModel } from '../models/EmailLog.model';
import type { EventDoc } from '../models/Event.model';
import { InviteeModel, type InviteeDoc } from '../models/Invitee.model';
import type { UserDoc } from '../models/User.model';
import { badRequest } from '../utils/AppError';
import { fillPlaceholders, renderEmail, type TemplateVars } from '../utils/emailTemplates';
import { formatDate, formatTime } from '../utils/format';
import { renderQrPng } from '../utils/qr';
import type { sendEmailSchema } from '../validators/email.schema';
import { getTransporter, sendMail } from './mail.service';

const CONCURRENCY = 3;

const buildVars = (event: EventDoc, guest: InviteeDoc): TemplateVars => ({
  name: guest.name,
  email: guest.email,
  company: guest.company ?? '',
  designation: guest.designation ?? '',
  eventTitle: event.title,
  eventDate: formatDate(event.date),
  eventTime: `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`,
  address: event.address || [event.venue, event.city].filter(Boolean).join(', '),
  ticketCode: guest.ticketCode,
  organizer: event.organizer || 'The organizers',
});

/** Runs `worker` over `items` with at most `limit` in flight. */
const runPool = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>) => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]!);
  });
  await Promise.all(lanes);
};

export const sendInvitations = async (
  actor: UserDoc,
  event: EventDoc,
  input: z.infer<typeof sendEmailSchema>,
) => {
  await getTransporter(); // fail fast (503) before touching anything if email is not configured

  const guests = await InviteeModel.find({ _id: { $in: input.inviteeIds }, eventId: event._id });
  if (!guests.length) throw badRequest('None of the selected guests belong to this event');

  const sent: string[] = [];
  const failed: { inviteeId: string; email: string; error: string }[] = [];

  await runPool(guests, CONCURRENCY, async (guest) => {
    const vars = buildVars(event, guest);
    const cid = `qr-${guest.id}@eventsphere`;
    try {
      const qrPng = input.includeQr ? await renderQrPng(guest.qrType as QrType, guest.qrPayload) : null;
      await sendMail({
        to: guest.email,
        subject: fillPlaceholders(input.subject, vars, false),
        html: renderEmail(input.templateId, {
          bodyHtml: input.bodyHtml,
          vars,
          qrDataUrl: qrPng ? `cid:${cid}` : null,
        }),
        attachments: qrPng ? [{ filename: `${guest.ticketCode}.png`, content: qrPng, cid }] : undefined,
      });
      sent.push(guest.id);
    } catch (err) {
      failed.push({ inviteeId: guest.id, email: guest.email, error: (err as Error).message });
    }
  });

  const now = new Date();
  await InviteeModel.bulkWrite([
    ...sent.map((id) => ({
      updateOne: { filter: { _id: id }, update: { $set: { emailStatus: 'sent' as const, emailSentAt: now, emailError: null } } },
    })),
    ...failed.map((f) => ({
      updateOne: { filter: { _id: f.inviteeId }, update: { $set: { emailStatus: 'failed' as const, emailError: f.error } } },
    })),
  ]);

  const log = await EmailLogModel.create({
    eventId: event._id,
    sentBy: actor._id,
    subject: input.subject,
    templateId: input.templateId,
    includeQr: input.includeQr,
    recipientCount: guests.length,
    sentCount: sent.length,
    failedCount: failed.length,
    sentAt: now,
  });

  return { log, sent: sent.length, failed };
};

/** Email history; `eventFilter` is a single event id or `{ $in: [...] }`, omitted for everything. */
export const listEmailLogs = (eventFilter?: unknown) =>
  EmailLogModel.find(eventFilter === undefined ? {} : { eventId: eventFilter })
    .sort({ sentAt: -1 })
    .populate('sentBy', 'name email');
