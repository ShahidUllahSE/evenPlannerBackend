import { env } from '../config/env';
import { AppSettingsModel } from '../models/AppSettings.model';
import { AppError } from '../utils/AppError';
import { decryptSecret } from '../utils/secret';

/** Admin panel overrides env when account SID, auth token, and from number are all set. */
export const resolveTwilioCredentials = async () => {
  const doc = await AppSettingsModel.findOne({ key: 'twilio' }).lean();
  const panelSid = doc?.twilioAccountSid?.trim() ?? '';
  const panelFrom = doc?.twilioFromNumber?.trim() ?? '';
  let panelToken = '';
  if (doc?.twilioAuthTokenEnc) {
    try {
      panelToken = decryptSecret(doc.twilioAuthTokenEnc);
    } catch {
      panelToken = '';
    }
  }

  const usePanel = Boolean(panelSid && panelToken && panelFrom);
  return {
    accountSid: usePanel ? panelSid : env.TWILIO_ACCOUNT_SID ?? '',
    authToken: usePanel ? panelToken : env.TWILIO_AUTH_TOKEN ?? '',
    fromNumber: usePanel ? panelFrom : env.TWILIO_FROM_NUMBER ?? '',
    source: usePanel ? ('panel' as const) : ('env' as const),
  };
};

/** Throws 503 when Twilio is not configured (panel or .env). */
export const requireTwilioCredentials = async () => {
  const creds = await resolveTwilioCredentials();
  if (!creds.accountSid || !creds.authToken || !creds.fromNumber) {
    throw new AppError(
      503,
      'Twilio is not configured. Set TWILIO_* in .env, or configure it in the admin panel.',
    );
  }
  return creds;
};
