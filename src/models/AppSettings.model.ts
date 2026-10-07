import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType, type Types } from 'mongoose';
import { baseOptions } from './plugins';

/** App config documents keyed by feature (`mail`, `twilio`, …). */
const appSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    /** Sender Gmail (or SMTP) address configured from the admin panel. */
    smtpUser: { type: String, trim: true, default: '' },
    /** Encrypted app password / SMTP password. Empty means fall back to env. */
    smtpPassEnc: { type: String, default: '' },
    /** Twilio Account SID from the admin panel. */
    twilioAccountSid: { type: String, trim: true, default: '' },
    /** Encrypted Twilio Auth Token. Empty means fall back to env. */
    twilioAuthTokenEnc: { type: String, default: '' },
    /** Twilio sender number in E.164 (e.g. +14155552671). */
    twilioFromNumber: { type: String, trim: true, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseOptions,
);

export type AppSettingsEntity = InferSchemaType<typeof appSettingsSchema> & { _id: Types.ObjectId };
export type AppSettingsDoc = HydratedDocumentFromSchema<typeof appSettingsSchema>;
export const AppSettingsModel = model('AppSettings', appSettingsSchema);
