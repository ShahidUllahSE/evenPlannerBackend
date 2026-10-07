import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { AppSettingsModel } from '../models/AppSettings.model';
import { AppError } from '../utils/AppError';
import { decryptSecret } from '../utils/secret';

let transporter: Transporter | null = null;
let mailFrom = env.MAIL_FROM;

/** Drop the cached transporter so the next send picks up new credentials. */
export const resetMailTransport = () => {
  transporter = null;
};

/** Admin panel overrides env when both email + password are saved. */
export const resolveMailCredentials = async () => {
  const doc = await AppSettingsModel.findOne({ key: 'mail' }).lean();
  const panelEmail = doc?.smtpUser?.trim() ?? '';
  let panelPass = '';
  if (doc?.smtpPassEnc) {
    try {
      panelPass = decryptSecret(doc.smtpPassEnc);
    } catch {
      panelPass = '';
    }
  }

  const usePanel = Boolean(panelEmail && panelPass);
  return {
    user: usePanel ? panelEmail : env.SMTP_USER ?? '',
    pass: usePanel ? panelPass : env.SMTP_PASS ?? '',
    from: usePanel ? `EventSphere <${panelEmail}>` : env.MAIL_FROM,
    source: usePanel ? ('panel' as const) : ('env' as const),
  };
};

const createTransporter = async (): Promise<Transporter> => {
  if (env.MAIL_TRANSPORT === 'log') {
    mailFrom = env.MAIL_FROM;
    return nodemailer.createTransport({ jsonTransport: true });
  }

  const { user, pass, from } = await resolveMailCredentials();
  if (!env.SMTP_HOST || !user || !pass) {
    throw new AppError(
      503,
      'Email is not configured. Set SMTP in .env, or configure email + app password in the admin panel.',
    );
  }

  mailFrom = from;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
  });
};

export const getTransporter = async () => {
  if (!transporter) transporter = await createTransporter();
  return transporter;
};

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; cid: string }[];
}

export const sendMail = async (mail: OutgoingMail) => {
  const transport = await getTransporter();
  const info = await transport.sendMail({ from: mailFrom, ...mail });
  if (env.MAIL_TRANSPORT === 'log') console.log(`[mail:log] to=${mail.to} subject="${mail.subject}"`);
  return info;
};
