import { z } from 'zod';
import { objectId } from './event.schema';

export const sendSmsSchema = z.object({
  inviteeIds: z.array(objectId).min(1).max(5000),
  /** Plain-text SMS body. Supports {{name}}, {{eventTitle}}, {{ticketCode}}, etc. */
  message: z.string().trim().min(1).max(1600),
  /** Attach each guest’s QR as an MMS image (Twilio mediaUrl), like email. */
  includeQr: z.boolean().default(true),
});
