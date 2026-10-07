import type { Types } from 'mongoose';
import type { z } from 'zod';
import { env } from '../config/env';
import { AppSettingsModel } from '../models/AppSettings.model';
import { badRequest } from '../utils/AppError';
import { encryptSecret } from '../utils/secret';
import type { updateMailSettingsSchema, updateTwilioSettingsSchema } from '../validators/settings.schema';
import { resetMailTransport, resolveMailCredentials } from './mail.service';
import { resolveTwilioCredentials } from './twilio.service';

const MAIL_KEY = 'mail';
const TWILIO_KEY = 'twilio';

const getMailDoc = () => AppSettingsModel.findOne({ key: MAIL_KEY });
const getTwilioDoc = () => AppSettingsModel.findOne({ key: TWILIO_KEY });

export const getMailSettings = async () => {
  const doc = await getMailDoc().lean();
  const credentials = await resolveMailCredentials();
  const panelEmail = doc?.smtpUser?.trim() ?? '';
  const hasPanelPassword = Boolean(doc?.smtpPassEnc);

  return {
    email: panelEmail,
    hasPassword: hasPanelPassword,
    /** Whether sends currently use the panel config or .env defaults. */
    activeSource: credentials.source,
    activeEmail: credentials.user || null,
    envConfigured: Boolean(env.SMTP_USER && env.SMTP_PASS),
    updatedAt: doc?.updatedAt ?? null,
  };
};

export const updateMailSettings = async (
  actorId: Types.ObjectId,
  input: z.infer<typeof updateMailSettingsSchema>,
) => {
  const email = input.email.trim().toLowerCase();
  const existing = await getMailDoc();
  const password = input.appPassword?.trim() ?? '';

  if (!password && !existing?.smtpPassEnc) {
    throw badRequest('App password is required the first time you configure email');
  }

  const update: Record<string, unknown> = {
    key: MAIL_KEY,
    smtpUser: email,
    updatedBy: actorId,
  };
  if (password) update.smtpPassEnc = encryptSecret(password);

  await AppSettingsModel.findOneAndUpdate({ key: MAIL_KEY }, { $set: update }, { upsert: true, new: true });
  resetMailTransport();
  return getMailSettings();
};

/** Remove panel overrides so sending falls back to .env. */
export const clearMailSettings = async () => {
  await AppSettingsModel.deleteOne({ key: MAIL_KEY });
  resetMailTransport();
  return getMailSettings();
};

export const getTwilioSettings = async () => {
  const doc = await getTwilioDoc().lean();
  const credentials = await resolveTwilioCredentials();
  const panelSid = doc?.twilioAccountSid?.trim() ?? '';
  const panelFrom = doc?.twilioFromNumber?.trim() ?? '';

  return {
    accountSid: panelSid,
    fromNumber: panelFrom,
    hasAuthToken: Boolean(doc?.twilioAuthTokenEnc),
    activeSource: credentials.source,
    activeAccountSid: credentials.accountSid || null,
    activeFromNumber: credentials.fromNumber || null,
    envConfigured: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER),
    updatedAt: doc?.updatedAt ?? null,
  };
};

export const updateTwilioSettings = async (
  actorId: Types.ObjectId,
  input: z.infer<typeof updateTwilioSettingsSchema>,
) => {
  const existing = await getTwilioDoc();
  const token = input.authToken?.trim() ?? '';

  if (!token && !existing?.twilioAuthTokenEnc) {
    throw badRequest('Auth token is required the first time you configure Twilio');
  }

  const update: Record<string, unknown> = {
    key: TWILIO_KEY,
    twilioAccountSid: input.accountSid.trim(),
    twilioFromNumber: input.fromNumber.trim(),
    updatedBy: actorId,
  };
  if (token) update.twilioAuthTokenEnc = encryptSecret(token);

  await AppSettingsModel.findOneAndUpdate({ key: TWILIO_KEY }, { $set: update }, { upsert: true, new: true });
  return getTwilioSettings();
};

/** Remove panel overrides so Twilio falls back to .env. */
export const clearTwilioSettings = async () => {
  await AppSettingsModel.deleteOne({ key: TWILIO_KEY });
  return getTwilioSettings();
};
