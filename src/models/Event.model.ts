import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType, type Types } from 'mongoose';
import { EVENT_CATEGORIES, EVENT_STATUSES, QR_TYPES } from '../constants/options';
import { baseOptions } from './plugins';

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, enum: EVENT_CATEGORIES, required: true },
    description: { type: String, default: '' },
    address: { type: String, required: true, trim: true },
    /** @deprecated Kept so older documents with venue/city still load. */
    venue: { type: String, trim: true },
    /** @deprecated Kept so older documents with venue/city still load. */
    city: { type: String, trim: true },
    date: { type: String, required: true }, // yyyy-mm-dd
    startTime: { type: String, required: true }, // HH:mm
    endTime: { type: String, required: true }, // HH:mm
    capacity: { type: Number, required: true, min: 1 },
    organizer: { type: String, default: '' },
    status: { type: String, enum: EVENT_STATUSES, default: 'draft' },
    /** QR style chosen at first import; every ticket for the event uses it. */
    qrType: { type: String, enum: [...QR_TYPES, null], default: null },
    /** The planner who owns this event. */
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Scanner accounts allowed to check guests in for this event. */
    scanners: [{ type: Schema.Types.ObjectId, ref: 'User', index: true }],
  },
  {
    ...baseOptions,
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        if (!ret.address) {
          ret.address = [ret.venue, ret.city].filter(Boolean).join(', ');
        }
        delete ret.venue;
        delete ret.city;
        return ret;
      },
    },
  },
);

export type EventEntity = InferSchemaType<typeof eventSchema> & { _id: Types.ObjectId };
export type EventDoc = HydratedDocumentFromSchema<typeof eventSchema>;
export const EventModel = model('Event', eventSchema);
