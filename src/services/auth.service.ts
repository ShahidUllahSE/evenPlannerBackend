import bcrypt from 'bcryptjs';
import { UserModel, type UserDoc } from '../models/User.model';
import { badRequest, unauthorized } from '../utils/AppError';
import { signToken } from '../utils/jwt';
import { hashPassword } from './user.service';

export const login = async (email: string, password: string) => {
  const user = await UserModel.findOne({ email }).select('+passwordHash');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !ok) throw unauthorized('Invalid email or password');
  if (!user.isActive) throw unauthorized('This account has been deactivated');

  user.lastLoginAt = new Date();
  await user.save();
  return { token: signToken({ sub: user.id, role: user.role }), user };
};

export const changePassword = async (actor: UserDoc, currentPassword: string, newPassword: string) => {
  const user = await UserModel.findById(actor._id).select('+passwordHash');
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('Current password is incorrect');
  }
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
};
