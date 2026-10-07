import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { env } from '../config/env';
import type { QrType } from '../constants/options';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const TICKET_CODE_RE = /^EP-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

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
  const text = raw.trim();

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
      return null;
    }
  }

  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const code = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
      if (!code) return null;
      return {
        ticketCode: code.toUpperCase(),
        eventId: url.searchParams.get('e') ?? undefined,
        signature: url.searchParams.get('s') ?? undefined,
      };
    } catch {
      return null;
    }
  }

  const code = text.toUpperCase();
  return TICKET_CODE_RE.test(code) ? { ticketCode: code } : null;
};

const QR_STYLE: Record<QrType, { dark: string; errorLevel: 'M' | 'H' }> = {
  standard: { dark: '#0F1B2D', errorLevel: 'M' },
  secure: { dark: '#1E3A5F', errorLevel: 'M' },
  branded: { dark: '#0E7C7B', errorLevel: 'H' },
};

/** PNG of the QR, styled like the frontend, for email attachments. */
export const renderQrPng = (type: QrType, payload: string, size = 336) =>
  QRCode.toBuffer(payload, {
    type: 'png',
    width: size,
    margin: 1,
    errorCorrectionLevel: QR_STYLE[type].errorLevel,
    color: { dark: QR_STYLE[type].dark, light: '#FFFFFF' },
  });
