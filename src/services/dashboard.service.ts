import { EventModel } from '../models/Event.model';
import { InviteeModel } from '../models/Invitee.model';
import { ScanLogModel } from '../models/ScanLog.model';
import { UserModel, type UserDoc } from '../models/User.model';
import { eventScope, scopedEventIds } from './access.service';

/** Headline numbers for the dashboard, scoped to what the user can see. */
export const getDashboard = async (actor: UserDoc) => {
  const eventIds = await scopedEventIds(actor);
  const inEvents = eventIds ? { eventId: { $in: eventIds } } : {};
  const scanFilter =
    actor.role === 'admin' ? {} : actor.role === 'planner' ? { plannerId: actor._id } : { scannerId: actor._id };

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [events, byStatus, guests, emailed, checkedIn, scansToday, recentScans, users] = await Promise.all([
    EventModel.countDocuments(eventScope(actor)),
    EventModel.aggregate<{ _id: string; count: number }>([
      { $match: eventScope(actor) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    InviteeModel.countDocuments(inEvents),
    InviteeModel.countDocuments({ ...inEvents, emailStatus: 'sent' }),
    InviteeModel.countDocuments({ ...inEvents, checkIn: 'checked_in' }),
    ScanLogModel.countDocuments({ ...scanFilter, createdAt: { $gte: startOfDay } }),
    ScanLogModel.find(scanFilter)
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('scannerId', 'name')
      .populate('inviteeId', 'name ticketCode')
      .populate('eventId', 'title'),
    actor.role === 'admin'
      ? UserModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$role', count: { $sum: 1 } } }])
      : Promise.resolve(null),
  ]);

  return {
    events: { total: events, byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])) },
    guests: { total: guests, emailed, checkedIn },
    scansToday,
    recentScans,
    users: users ? Object.fromEntries(users.map((u) => [u._id, u.count])) : undefined,
  };
};
