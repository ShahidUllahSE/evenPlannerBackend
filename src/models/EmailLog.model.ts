import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { EMAIL_TEMPLATE_IDS } from '../constants/options';
import { baseOptions } from './plugins';

const emailLogSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    templateId: { type: String, enum: EMAIL_TEMPLATE_IDS, required: true },
    includeQr: { type: Boolean, default: true },
    recipientCount: { type: Number, required: true },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
  },
  baseOptions,
);

export type EmailLog = InferSchemaType<typeof emailLogSchema> & { _id: Types.ObjectId };
export const EmailLogModel = model('EmailLog', emailLogSchema);
