import { z } from 'zod';
import { objectId } from './event.schema';

export const scanSchema = z.object({
  eventId: objectId,
  /** Raw text read from the QR code, or a ticket code typed by hand. */
  payload: z.string().trim().min(1).max(2000),
});
