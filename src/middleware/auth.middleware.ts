import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../constants/roles';
import { UserModel } from '../models/User.model';
import { forbidden, unauthorized } from '../utils/AppError';
import { verifyToken } from '../utils/jwt';

/** Requires a valid Bearer token and loads the current user (so deactivation takes effect immediately). */
export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  let userId: string;
  try {
    userId = verifyToken(header.slice(7)).sub;
  } catch {
    throw unauthorized('Session expired, please log in again');
  }

  const user = await UserModel.findById(userId);
  if (!user || !user.isActive) throw unauthorized('Account not found or deactivated');
  req.user = user;
  next();
};

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };

/** Current user; only call after `authenticate`. */
export const currentUser = (req: Request) => {
  if (!req.user) throw unauthorized();
  return req.user;
};
