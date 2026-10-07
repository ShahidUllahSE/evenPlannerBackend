import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware';
import * as authService from '../services/auth.service';

export const loginController = async (req: Request, res: Response) => {
  const { token, user } = await authService.login(req.body.email, req.body.password);
  res.status(200).json({ success: true, token, user });
};

export const meController = (req: Request, res: Response) => {
  res.status(200).json({ success: true, user: currentUser(req) });
};

export const updateProfileController = async (req: Request, res: Response) => {
  const user = currentUser(req);
  user.set(req.body);
  await user.save();
  res.status(200).json({ success: true, user });
};

export const changePasswordController = async (req: Request, res: Response) => {
  await authService.changePassword(currentUser(req), req.body.currentPassword, req.body.newPassword);
  res.status(200).json({ success: true, message: 'Password updated' });
};
