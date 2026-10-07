import type { Types } from 'mongoose';
import { EventModel, type EventDoc } from '../models/Event.model';
import type { UserDoc } from '../models/User.model';
import { forbidden, notFound } from '../utils/AppError';

/**
 * Which events a user can see:
 *  admin   -> all events
 *  planner -> events they created
 *  scanner -> events they are assigned to
 */
export const eventScope = (user: UserDoc): Record<string, unknown> => {
  switch (user.role) {
    case 'admin':
      return {};
    case 'planner':
      return { createdBy: user._id };
    case 'scanner':
      return { scanners: user._id };
  }
};

export const canManageEvent = (user: UserDoc, event: EventDoc) =>
  user.role === 'admin' || (user.role === 'planner' && event.createdBy.equals(user._id));

/** Loads an event the user can see. Out-of-scope events are reported as 404 so ids cannot be probed. */
export const getVisibleEvent = async (user: UserDoc, eventId: string) => {
  const event = await EventModel.findOne({ _id: eventId, ...eventScope(user) });
  if (!event) throw notFound('Event not found');
  return event;
};

/** Loads an event the user may edit (admin, or the planner who owns it). */
export const getManagedEvent = async (user: UserDoc, eventId: string) => {
  const event = await getVisibleEvent(user, eventId);
  if (!canManageEvent(user, event)) throw forbidden('Only the event owner or an admin can do this');
  return event;
};

/** Ids of every event in the user's scope, or null for "no restriction" (admin). */
export const scopedEventIds = async (user: UserDoc): Promise<Types.ObjectId[] | null> => {
  if (user.role === 'admin') return null;
  const events = await EventModel.find(eventScope(user)).select('_id').lean();
  return events.map((e) => e._id);
};
