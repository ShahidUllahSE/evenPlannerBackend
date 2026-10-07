import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5050),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  QR_SECRET: z.string().min(32, 'QR_SECRET must be at least 32 characters'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  /**
   * Public base URL of this API (no trailing slash), used so Twilio can fetch QR PNGs for MMS.
   * Defaults to first CLIENT_URL + "/api" (same-host nginx proxy). Use a tunnel URL when testing MMS locally.
   */
  API_PUBLIC_URL: z.string().url().optional(),
  VERIFY_BASE_URL: z.string().url().default('https://eventsphere.app/verify'),
  MAIL_TRANSPORT: z.enum(['smtp', 'log']).default('smtp'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('EventSphere <no-reply@eventsphere.app>'),
  /** Twilio SMS only. "sms" sends for real; "log" prints to the console. */
  TWILIO_TRANSPORT: z.enum(['sms', 'log']).default('sms'),
  /** Twilio defaults; an admin can override these from the panel. */
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

const clientOrigins = parsed.data.CLIENT_URL.split(',').map((o) => o.trim()).filter(Boolean);

export const env = {
  ...parsed.data,
  CLIENT_ORIGINS: clientOrigins,
  /** Absolute API origin Twilio (and guests) can reach for QR media. */
  API_PUBLIC_BASE:
    (parsed.data.API_PUBLIC_URL ?? `${clientOrigins[0] ?? 'http://localhost:5173'}/api`).replace(/\/$/, ''),
  isProd: parsed.data.NODE_ENV === 'production',
};
