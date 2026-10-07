import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { env } from '../config/env';
import type { QrType } from '../constants/options';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const TICKET_CODE_RE = /^EP-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const TICKET_CODE_FIND_RE = /EP-[A-Z2-9]{4}-[A-Z2-9]{4}/;

const randomChunk = (length: number) =>
  Array.from({ length }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');

export const generateTicketCode = () => `EP-${randomChunk(4)}-${randomChunk(4)}`;

interface TicketIds {
  ticketCode: string;
  eventId: string;
  inviteeId: string;
}

/** HMAC signature so QR contents cannot be forged without the server secret. */
export const signTicket = ({ ticketCode, eventId, inviteeId }: TicketIds) =>
  createHmac('sha256', env.QR_SECRET)
    .update(`${ticketCode}|${eventId}|${inviteeId}`)
    .digest('base64url')
    .slice(0, 22);

export const verifySignature = (ids: TicketIds, signature: string) => {
  const expected = Buffer.from(signTicket(ids));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

export const buildQrPayload = (type: QrType, ids: TicketIds): string => {
  const sig = signTicket(ids);
  switch (type) {
    case 'standard':
      return ids.ticketCode;
    case 'secure':
      return JSON.stringify({ v: 1, t: ids.ticketCode, e: ids.eventId, u: ids.inviteeId, s: sig });
    case 'branded':
      return `${env.VERIFY_BASE_URL}/${ids.ticketCode}?e=${ids.eventId}&s=${sig}`;
  }
};

export interface ParsedQr {
  ticketCode: string;
  eventId?: string;
  inviteeId?: string;
  signature?: string;
}

/** Reads any of the three QR formats, or a ticket code typed in by hand. */
export const parseQrPayload = (raw: string): ParsedQr | null => {
  const text = raw.trim().replace(/\u0000/g, '');

  if (text.startsWith('{')) {
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (typeof data.t !== 'string') return null;
      return {
        ticketCode: data.t.toUpperCase(),
        eventId: typeof data.e === 'string' ? data.e : undefined,
        inviteeId: typeof data.u === 'string' ? data.u : undefined,
        signature: typeof data.s === 'string' ? data.s : undefined,
      };
    } catch {
      // fall through — noisy scans sometimes wrap JSON
    }
  }

  if (/^https?:\/\//i.test(text) || text.includes('://') || text.includes('/verify/')) {
    try {
      const urlText = /^https?:\/\//i.test(text) ? text : text.replace(/^[^h]*?(https?:\/\/)/i, '$1');
      const url = new URL(urlText);
      const code = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
      if (code) {
        return {
          ticketCode: code.toUpperCase(),
          eventId: url.searchParams.get('e') ?? undefined,
          signature: url.searchParams.get('s') ?? undefined,
        };
      }
    } catch {
      // fall through to ticket-code extraction
    }
  }

  const upper = text.toUpperCase();
  if (TICKET_CODE_RE.test(upper)) return { ticketCode: upper };

  // Phone cameras sometimes return surrounding junk — pull the ticket out.
  const found = upper.match(TICKET_CODE_FIND_RE);
  return found ? { ticketCode: found[0] } : null;
};

/** High-contrast black modules + wide quiet zone for phone cameras. */
const QR_STYLE: Record<QrType, { dark: string; errorLevel: 'M' | 'H' }> = {
  standard: { dark: '#000000', errorLevel: 'M' },
  secure: { dark: '#000000', errorLevel: 'M' },
  branded: { dark: '#000000', errorLevel: 'H' },
};

/** Default guest-facing PNG size (email / MMS). Larger = easier phone scan. */
export const GUEST_QR_SIZE = 512;

/** PNG of the QR for email attachments and MMS media. */
export const renderQrPng = (type: QrType, payload: string, size = GUEST_QR_SIZE) =>
  QRCode.toBuffer(payload, {
    type: 'png',
    width: size,
    // Spec quiet zone is 4 modules — phones need this white border.
    margin: 4,
    errorCorrectionLevel: QR_STYLE[type].errorLevel,
    color: { dark: QR_STYLE[type].dark, light: '#FFFFFF' },
  });

/** Short-lived signed URL so Twilio can fetch a guest QR PNG without login. */
const signMediaToken = (inviteeId: string, exp: number) =>
  createHmac('sha256', env.QR_SECRET).update(`mms-qr|${inviteeId}|${exp}`).digest('base64url');

export const buildQrMediaUrl = (inviteeId: string, ttlSeconds = 60 * 60 * 24 * 7) => {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signMediaToken(inviteeId, exp);
  return `${env.API_PUBLIC_BASE}/public/qr/${inviteeId}.png?exp=${exp}&sig=${sig}`;
};

export const verifyQrMediaToken = (inviteeId: string, expRaw: string, sig: string) => {
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = Buffer.from(signMediaToken(inviteeId, exp));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
};
