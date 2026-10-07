import { Types } from 'mongoose';
import type { z } from 'zod';
import { EmailLogModel } from '../models/EmailLog.model';
import { EventModel, type EventDoc } from '../models/Event.model';
import { InviteeModel } from '../models/Invitee.model';
import { ScanLogModel } from '../models/ScanLog.model';
import { UserModel, type UserDoc } from '../models/User.model';
import { badRequest, forbidden } from '../utils/AppError';
import type { createEventSchema, updateEventSchema } from '../validators/event.schema';
import { eventScope } from './access.service';

const OWNER_FIELDS = 'name email';

interface EventCounts {
  guests: number;
  emailed: number;
  checkedIn: number;
}

/** Guest / emailed / checked-in totals per event, in one aggregation. */
const countsByEvent = async (eventIds: Types.ObjectId[]) => {
  const rows = await InviteeModel.aggregate<EventCounts & { _id: Types.ObjectId }>([
    { $match: { eventId: { $in: eventIds } } },
    {
      $group: {
        _id: '$eventId',
        guests: { $sum: 1 },
        emailed: { $sum: { $cond: [{ $eq: ['$emailStatus', 'sent'] }, 1, 0] } },
        checkedIn: { $sum: { $cond: [{ $eq: ['$checkIn', 'checked_in'] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map(({ _id, ...counts }) => [String(_id), counts]));
};

export const listEvents = async (actor: UserDoc, filters: { status?: string; plannerId?: string }) => {
  const query: Record<string, unknown> = { ...eventScope(actor) };
  if (filters.status) query.status = filters.status;
  if (filters.plannerId && actor.role === 'admin') query.createdBy = filters.plannerId;

  const events = await EventModel.find(query).sort({ date: 1 }).populate('createdBy', OWNER_FIELDS);
  const counts = await countsByEvent(events.map((e) => e._id));
  return events.map((e) => ({
    ...e.toJSON(),
    stats: counts.get(e.id) ?? { guests: 0, emailed: 0, checkedIn: 0 },
  }));
};

export const createEvent = async (actor: UserDoc, input: z.infer<typeof createEventSchema>) => {
  const { plannerId, ...data } = input;
  let ownerId = actor._id;

  if (plannerId) {
    if (actor.role !== 'admin') throw forbidden('Only admins can create events for another planner');
    const planner = await UserModel.findOne({ _id: plannerId, role: 'planner', isActive: true });
    if (!planner) throw badRequest('plannerId must be an active planner');
    ownerId = planner._id;
  }
  if (data.endTime <= data.startTime) throw badRequest('End time must be after start time');

  const event = await EventModel.create({ ...data, createdBy: ownerId });
  return event.populate('createdBy', OWNER_FIELDS);
};

export const updateEvent = async (event: EventDoc, input: z.infer<typeof updateEventSchema>) => {
  event.set(input);
  if (event.endTime <= event.startTime) throw badRequest('End time must be after start time');
  await event.save();
  return event.populate('createdBy', OWNER_FIELDS);
};

export const deleteEvent = async (event: EventDoc) => {
  await Promise.all([
    InviteeModel.deleteMany({ eventId: event._id }),
    EmailLogModel.deleteMany({ eventId: event._id }),
    ScanLogModel.deleteMany({ eventId: event._id }),
  ]);
  await event.deleteOne();
};

export const listEventScanners = (event: EventDoc) =>
  UserModel.find({ _id: { $in: event.scanners } }).select('name email phone isActive createdBy');

/**
 * Replaces the event's scanner list.
 * Admins may assign any scanner. Planners may add scanners they created, and keep
 * (or remove) ones an admin already assigned.
 */
export const assignScanners = async (actor: UserDoc, event: EventDoc, scannerIds: string[]) => {
  const ids = [...new Set(scannerIds)];
  const scanners = await UserModel.find({ _id: { $in: ids }, role: 'scanner' });
  if (scanners.length !== ids.length) throw badRequest('Every id must belong to a scanner account');

  if (actor.role === 'planner') {
    const alreadyAssigned = new Set(event.scanners.map(String));
    const notAllowed = scanners.filter(
      (s) => !alreadyAssigned.has(s.id) && !s.createdBy?.equals(actor._id),
    );
    if (notAllowed.length) {
      throw forbidden(`You can only assign scanners you created: ${notAllowed.map((s) => s.email).join(', ')}`);
    }
  }

  event.scanners = scanners.map((s) => s._id);
  await event.save();
  return listEventScanners(event);
};

/** Tracking summary for one event: guests, RSVPs, emails, check-ins and scans per scanner. */
export const getEventStats = async (event: EventDoc) => {
  const [invitees] = await InviteeModel.aggregate([
    { $match: { eventId: event._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        emailed: { $sum: { $cond: [{ $eq: ['$emailStatus', 'sent'] }, 1, 0] } },
        emailFailed: { $sum: { $cond: [{ $eq: ['$emailStatus', 'failed'] }, 1, 0] } },
        checkedIn: { $sum: { $cond: [{ $eq: ['$checkIn', 'checked_in'] }, 1, 0] } },
        accepted: { $sum: { $cond: [{ $eq: ['$rsvp', 'accepted'] }, 1, 0] } },
        declined: { $sum: { $cond: [{ $eq: ['$rsvp', 'declined'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0 } },
  ]);

  const scanResults = await ScanLogModel.aggregate<{ _id: string; count: number }>([
    { $match: { eventId: event._id } },
    { $group: { _id: '$result', count: { $sum: 1 } } },
  ]);

  const byScanner = await ScanLogModel.aggregate([
    { $match: { eventId: event._id } },
    {
      $group: {
        _id: '$scannerId',
        total: { $sum: 1 },
        admitted: { $sum: { $cond: [{ $eq: ['$result', 'valid'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $ne: ['$result', 'valid'] }, 1, 0] } },
        lastScanAt: { $max: '$createdAt' },
      },
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'scanner' } },
    {
      $project: {
        _id: 0,
        scannerId: '$_id',
        name: { $ifNull: [{ $first: '$scanner.name' }, 'Deleted user'] },
        email: { $first: '$scanner.email' },
        total: 1,
        admitted: 1,
        rejected: 1,
        lastScanAt: 1,
      },
    },
    { $sort: { admitted: -1 } },
  ]);

  const guests = invitees ?? { total: 0, emailed: 0, emailFailed: 0, checkedIn: 0, accepted: 0, declined: 0 };
  return {
    eventId: event.id,
    capacity: event.capacity,
    guests: { ...guests, notCheckedIn: guests.total - guests.checkedIn },
    scans: Object.fromEntries(scanResults.map((r) => [r._id, r.count])),
    byScanner,
  };
};
