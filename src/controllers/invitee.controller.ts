import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware';
import { scopedEventIds } from '../services/access.service';
import { listEmailLogs } from '../services/email.service';
import * as inviteeService from '../services/invitee.service';
import { queryString } from '../utils/query';

export const listInviteesController = async (req: Request, res: Response) => {
  const invitees = await inviteeService.listInvitees(currentUser(req), {
    eventId: queryString(req.query.eventId),
    q: queryString(req.query.q),
    checkIn: queryString(req.query.checkIn),
    emailStatus: queryString(req.query.emailStatus),
  });
  res.status(200).json({ success: true, invitees });
};

export const updateInviteeController = async (req: Request, res: Response) => {
  const invitee = await inviteeService.updateInvitee(currentUser(req), String(req.params.id), req.body);
  res.status(200).json({ success: true, invitee });
};

export const deleteInviteeController = async (req: Request, res: Response) => {
  const invitee = await inviteeService.getManagedInvitee(currentUser(req), String(req.params.id));
  await invitee.deleteOne();
  res.status(200).json({ success: true, deleted: 1 });
};

export const bulkDeleteInviteesController = async (req: Request, res: Response) => {
  const deleted = await inviteeService.deleteInvitees(currentUser(req), req.body.ids);
  res.status(200).json({ success: true, deleted });
};

export const listEmailLogsController = async (req: Request, res: Response) => {
  const eventIds = await scopedEventIds(currentUser(req));
  const emailLogs = await listEmailLogs(eventIds ? { $in: eventIds } : undefined);
  res.status(200).json({ success: true, emailLogs });
};
