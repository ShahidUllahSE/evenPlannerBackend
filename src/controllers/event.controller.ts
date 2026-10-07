import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware';
import { getManagedEvent, getVisibleEvent } from '../services/access.service';
import { listEmailLogs, sendInvitations } from '../services/email.service';
import * as eventService from '../services/event.service';
import * as inviteeService from '../services/invitee.service';
import { queryString } from '../utils/query';

const eventId = (req: Request) => String(req.params.id);

export const listEventsController = async (req: Request, res: Response) => {
  const events = await eventService.listEvents(currentUser(req), {
    status: queryString(req.query.status),
    plannerId: queryString(req.query.plannerId),
  });
  res.status(200).json({ success: true, events });
};

export const createEventController = async (req: Request, res: Response) => {
  const event = await eventService.createEvent(currentUser(req), req.body);
  res.status(201).json({ success: true, event });
};

export const getEventController = async (req: Request, res: Response) => {
  const event = await getVisibleEvent(currentUser(req), eventId(req));
  await event.populate('createdBy', 'name email');
  res.status(200).json({ success: true, event });
};

export const updateEventController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  res.status(200).json({ success: true, event: await eventService.updateEvent(event, req.body) });
};

export const deleteEventController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  await eventService.deleteEvent(event);
  res.status(200).json({ success: true, message: 'Event deleted' });
};

export const eventStatsController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  res.status(200).json({ success: true, stats: await eventService.getEventStats(event) });
};

export const listEventScannersController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  res.status(200).json({ success: true, scanners: await eventService.listEventScanners(event) });
};

export const assignScannersController = async (req: Request, res: Response) => {
  const actor = currentUser(req);
  const event = await getManagedEvent(actor, eventId(req));
  const scanners = await eventService.assignScanners(actor, event, req.body.scannerIds);
  res.status(200).json({ success: true, scanners });
};

export const listEventInviteesController = async (req: Request, res: Response) => {
  const invitees = await inviteeService.listInvitees(currentUser(req), {
    eventId: eventId(req),
    q: queryString(req.query.q),
    checkIn: queryString(req.query.checkIn),
    emailStatus: queryString(req.query.emailStatus),
  });
  res.status(200).json({ success: true, invitees });
};

export const addInviteeController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  const invitee = await inviteeService.addInvitee(event, req.body);
  res.status(201).json({ success: true, invitee, event });
};

export const importInviteesController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  const result = await inviteeService.importInvitees(event, req.body.rows, req.body.qrType);
  res.status(201).json({ success: true, ...result, event });
};

export const regenerateQrController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  const updated = await inviteeService.regenerateQrCodes(event, req.body.qrType);
  res.status(200).json({ success: true, updated, event });
};

export const sendEmailsController = async (req: Request, res: Response) => {
  const actor = currentUser(req);
  const event = await getManagedEvent(actor, eventId(req));
  const result = await sendInvitations(actor, event, req.body);
  res.status(200).json({ success: true, ...result });
};

export const listEventEmailLogsController = async (req: Request, res: Response) => {
  const event = await getManagedEvent(currentUser(req), eventId(req));
  res.status(200).json({ success: true, emailLogs: await listEmailLogs(event._id) });
};
