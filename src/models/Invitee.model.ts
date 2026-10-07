import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType, type Types } from 'mongoose';
import {
  CHECK_IN_STATUSES,
  EMAIL_STATUSES,
  INVITEE_CATEGORIES,
  QR_TYPES,
  RSVP_STATUSES,
} from '../constants/options';
import { baseOptions } from './plugins';

const inviteeSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    company: { type: String, default: '' },
    designation: { type: String, default: '' },
    city: { type: String, default: '' },
    category: { type: String, enum: INVITEE_CATEGORIES, default: 'Guest' },
    /** Human-readable unique ticket id, e.g. EP-7K3F-9QX2 */
    ticketCode: { type: String, required: true, unique: true },
    qrType: { type: String, enum: QR_TYPES, required: true },
    /** Exact string encoded in the QR. */
    qrPayload: { type: String, required: true },
    rsvp: { type: String, enum: RSVP_STATUSES, default: 'pending' },
    emailStatus: { type: String, enum: EMAIL_STATUSES, default: 'not_sent' },
    emailSentAt: { type: Date, default: null },
    emailError: { type: String, default: null },
    /** checked_in = the ticket has been used. */
    checkIn: { type: String, enum: CHECK_IN_STATUSES, default: 'not_checked_in' },
    checkedInAt: { type: Date, default: null },
    /** The scanner (or planner/admin) who admitted this guest. */
    checkedInBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseOptions,
);

// One guest per email per event.
inviteeSchema.index({ eventId: 1, email: 1 }, { unique: true });

export type Invitee = InferSchemaType<typeof inviteeSchema> & { _id: Types.ObjectId };
export type InviteeDoc = HydratedDocumentFromSchema<typeof inviteeSchema>;
export const InviteeModel = model('Invitee', inviteeSchema);
