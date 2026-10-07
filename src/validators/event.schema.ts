import { z } from 'zod';
import { EVENT_CATEGORIES, EVENT_STATUSES, QR_TYPES } from '../constants/options';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

const eventFields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  category: z.enum(EVENT_CATEGORIES),
  description: z.string().trim().max(5000).default(''),
  address: z.string().trim().min(2).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  startTime: time,
  endTime: time,
  capacity: z.coerce.number().int().min(1).max(1_000_000),
  organizer: z.string().trim().max(150).default(''),
  status: z.enum(EVENT_STATUSES).default('draft'),
};

export const createEventSchema = z.object({
  ...eventFields,
  /** Admin only: create the event on behalf of this planner. */
  plannerId: objectId.optional(),
});

export const updateEventSchema = z.object(eventFields).partial();

export const assignScannersSchema = z.object({
  scannerIds: z.array(objectId).max(200),
});

export const qrTypeSchema = z.object({ qrType: z.enum(QR_TYPES) });

export { objectId };
