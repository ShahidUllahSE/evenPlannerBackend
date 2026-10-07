import { z } from 'zod';
import { CHECK_IN_STATUSES, INVITEE_CATEGORIES, QR_TYPES, RSVP_STATUSES } from '../constants/options';
import { objectId } from './event.schema';

export const inviteeInputSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().max(30).default(''),
  company: z.string().trim().max(150).default(''),
  designation: z.string().trim().max(150).default(''),
  city: z.string().trim().max(100).default(''),
  category: z.enum(INVITEE_CATEGORIES).default('Guest'),
});

export const importInviteesSchema = z.object({
  rows: z.array(inviteeInputSchema).min(1).max(5000),
  qrType: z.enum(QR_TYPES),
});

export const updateInviteeSchema = inviteeInputSchema.partial().extend({
  rsvp: z.enum(RSVP_STATUSES).optional(),
  checkIn: z.enum(CHECK_IN_STATUSES).optional(),
});

export const bulkDeleteSchema = z.object({ ids: z.array(objectId).min(1).max(5000) });
