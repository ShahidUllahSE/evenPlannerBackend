import twilio from 'twilio';
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
      'Twilio SMS is not configured. Set TWILIO_* in .env, or configure it in the admin panel.',
    );
  }
  return creds;
};

/** Normalize a guest phone to E.164 when possible. */
export const normalizeSmsPhone = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) return null;
  if (!/^\+[1-9]\d{6,14}$/.test(digits)) return null;
  return digits;
};

/**
 * Send one SMS/MMS via Twilio Messages API (no voice calls / WhatsApp).
 * Pass `mediaUrls` to attach images (e.g. QR PNG) as MMS.
 * When TWILIO_TRANSPORT=log, prints to the console instead of calling Twilio.
 */
export const sendSms = async (to: string, body: string, mediaUrls?: string[]) => {
  const creds = await requireTwilioCredentials();
  const media = mediaUrls?.filter(Boolean) ?? [];

  if (env.TWILIO_TRANSPORT === 'log') {
    console.log(
      `[sms:log] to=${to} from=${creds.fromNumber} body="${body.slice(0, 80)}${body.length > 80 ? '…' : ''}"` +
        (media.length ? ` media=${media.join(' ')}` : ''),
    );
    return { sid: `log_${Date.now()}`, to, status: 'logged' as const };
  }

  const client = twilio(creds.accountSid, creds.authToken);
  const message = await client.messages.create({
    to,
    from: creds.fromNumber,
    body,
    ...(media.length ? { mediaUrl: media } : {}),
  });

  return { sid: message.sid, to, status: message.status };
};
