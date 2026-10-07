import type { Request, Response } from 'express';
import type { QrType } from '../constants/options';
import { InviteeModel } from '../models/Invitee.model';
import { AppError } from '../utils/AppError';
import { GUEST_QR_SIZE, renderQrPng, verifyQrMediaToken } from '../utils/qr';

/** Public PNG for MMS — Twilio fetches this URL; requires a valid signed query. */
export const publicQrPngController = async (req: Request, res: Response) => {
  const rawId = Array.isArray(req.params.inviteeId)
    ? (req.params.inviteeId[0] ?? '')
    : (req.params.inviteeId ?? '');
  const inviteeId = String(rawId).replace(/\.png$/i, '');
  const exp = typeof req.query.exp === 'string' ? req.query.exp : '';
  const sig = typeof req.query.sig === 'string' ? req.query.sig : '';

  if (!inviteeId || !verifyQrMediaToken(inviteeId, exp, sig)) {
    throw new AppError(403, 'Invalid or expired QR link');
  }

  const guest = await InviteeModel.findById(inviteeId);
  if (!guest) throw new AppError(404, 'Ticket not found');

  // Slightly larger for MMS carrier compression.
  const png = await renderQrPng(guest.qrType as QrType, guest.qrPayload, Math.max(GUEST_QR_SIZE, 560));
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(png);
};
