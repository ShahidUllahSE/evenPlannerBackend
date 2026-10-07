import { z } from 'zod';
import { EMAIL_TEMPLATE_IDS } from '../constants/options';
import { objectId } from './event.schema';

export const sendEmailSchema = z.object({
  inviteeIds: z.array(objectId).min(1).max(5000),
  subject: z.string().trim().min(1).max(300),
  bodyHtml: z.string().min(1).max(100_000),
  templateId: z.enum(EMAIL_TEMPLATE_IDS),
  includeQr: z.boolean().default(true),
});
