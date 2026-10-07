import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { SCAN_RESULTS } from '../constants/options';
import { baseOptions } from './plugins';

/** Every scan attempt at the door, successful or not. */
const scanLogSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    /** Owner of the event, stored so planners can query their scans directly. */
    plannerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scannerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Null when the code did not match any ticket. */
    inviteeId: { type: Schema.Types.ObjectId, ref: 'Invitee', default: null, index: true },
    ticketCode: { type: String, default: null },
    result: { type: String, enum: SCAN_RESULTS, required: true },
    rawPayload: { type: String, default: '' },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  baseOptions,
);

scanLogSchema.index({ eventId: 1, createdAt: -1 });

export type ScanLog = InferSchemaType<typeof scanLogSchema> & { _id: Types.ObjectId };
export const ScanLogModel = model('ScanLog', scanLogSchema);
