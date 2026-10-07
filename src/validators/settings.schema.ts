import { z } from 'zod';

export const updateMailSettingsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address').max(200),
  /** Omit or leave empty to keep the currently saved app password. */
  appPassword: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || v.length >= 4, 'App password is too short'),
});

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use E.164 format, e.g. +14155552671');

export const updateTwilioSettingsSchema = z.object({
  accountSid: z
    .string()
    .trim()
    .regex(/^AC[a-f0-9]{32}$/i, 'Account SID should look like ACxxxxxxxx…'),
  fromNumber: e164,
  /** Omit or leave empty to keep the currently saved auth token. */
  authToken: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || v.length >= 16, 'Auth token looks too short'),
});