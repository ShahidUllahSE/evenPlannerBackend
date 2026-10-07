import bcrypt from 'bcryptjs';
import type { z } from 'zod';
import { EventModel } from '../models/Event.model';
import { UserModel, type UserDoc } from '../models/User.model';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError';
import { escapeRegex } from '../utils/format';
import type { createUserSchema, updateUserSchema } from '../validators/user.schema';

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

interface ListFilters {
  role?: string;
  q?: string;
}

/** Admin sees every account; a planner sees only the scanners they created. */
export const listUsers = async (actor: UserDoc, { role, q }: ListFilters) => {
  const filter: Record<string, unknown> =
    actor.role === 'admin' ? {} : { role: 'scanner', createdBy: actor._id };
  if (role && actor.role === 'admin') filter.role = role;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { email: re }];
  }
  return UserModel.find(filter).sort({ createdAt: -1 }).populate('createdBy', 'name email role');
};

export const createUser = async (actor: UserDoc, input: z.infer<typeof createUserSchema>) => {
  if (actor.role === 'planner' && input.role !== 'scanner') {
    throw forbidden('Planners can only create scanner accounts');
  }
  if (await UserModel.exists({ email: input.email })) throw conflict('Email is already registered');

  const { password, ...rest } = input;
  return UserModel.create({ ...rest, passwordHash: await hashPassword(password), createdBy: actor._id });
};

/** A user the actor may edit or delete: admin -> anyone, planner -> their own scanners. */
export const getManageableUser = async (actor: UserDoc, userId: string) => {
  const user = await UserModel.findById(userId);
  const allowed =
    user &&
    (actor.role === 'admin' ||
      (user.role === 'scanner' && user.createdBy?.equals(actor._id)));
  if (!allowed) throw notFound('User not found');
  return user;
};

export const updateUser = async (
  actor: UserDoc,
  userId: string,
  input: z.infer<typeof updateUserSchema>,
) => {
  const user = await getManageableUser(actor, userId);
  if (user._id.equals(actor._id) && input.isActive === false) {
    throw badRequest('You cannot deactivate your own account');
  }
  if (input.email && input.email !== user.email && (await UserModel.exists({ email: input.email }))) {
    throw conflict('Email is already registered');
  }

  const { password, ...rest } = input;
  user.set(rest);
  if (password) user.passwordHash = await hashPassword(password);
  return user.save();
};

export const deleteUser = async (actor: UserDoc, userId: string) => {
  const user = await getManageableUser(actor, userId);
  if (user._id.equals(actor._id)) throw badRequest('You cannot delete your own account');
  if (user.role === 'planner' && (await EventModel.exists({ createdBy: user._id }))) {
    throw conflict('This planner still owns events. Deactivate the account instead, or delete their events first.');
  }

  await EventModel.updateMany({ scanners: user._id }, { $pull: { scanners: user._id } });
  // Scan logs keep the id so history stays intact.
  await user.deleteOne();
};
