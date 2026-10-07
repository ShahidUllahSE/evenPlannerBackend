import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware';
import * as userService from '../services/user.service';
import { queryString } from '../utils/query';

export const listUsersController = async (req: Request, res: Response) => {
  const users = await userService.listUsers(currentUser(req), {
    role: queryString(req.query.role),
    q: queryString(req.query.q),
  });
  res.status(200).json({ success: true, users });
};

export const createUserController = async (req: Request, res: Response) => {
  const user = await userService.createUser(currentUser(req), req.body);
  res.status(201).json({ success: true, user });
};

export const getUserController = async (req: Request, res: Response) => {
  const user = await userService.getManageableUser(currentUser(req), String(req.params.id));
  res.status(200).json({ success: true, user });
};

export const updateUserController = async (req: Request, res: Response) => {
  const user = await userService.updateUser(currentUser(req), String(req.params.id), req.body);
  res.status(200).json({ success: true, user });
};

export const deleteUserController = async (req: Request, res: Response) => {
  await userService.deleteUser(currentUser(req), String(req.params.id));
  res.status(200).json({ success: true, message: 'User deleted' });
};
