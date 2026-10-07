import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.middleware';
import * as settingsService from '../services/settings.service';

export const getMailSettingsController = async (_req: Request, res: Response) => {
  const settings = await settingsService.getMailSettings();
  res.status(200).json({ success: true, settings });
};

export const updateMailSettingsController = async (req: Request, res: Response) => {
  const settings = await settingsService.updateMailSettings(currentUser(req)._id, req.body);
  res.status(200).json({ success: true, settings });
};

export const clearMailSettingsController = async (_req: Request, res: Response) => {
  const settings = await settingsService.clearMailSettings();
  res.status(200).json({ success: true, settings });
};

export const getTwilioSettingsController = async (_req: Request, res: Response) => {
  const settings = await settingsService.getTwilioSettings();
  res.status(200).json({ success: true, settings });
};

export const updateTwilioSettingsController = async (req: Request, res: Response) => {
  const settings = await settingsService.updateTwilioSettings(currentUser(req)._id, req.body);
  res.status(200).json({ success: true, settings });
};

export const clearTwilioSettingsController = async (_req: Request, res: Response) => {
  const settings = await settingsService.clearTwilioSettings();
  res.status(200).json({ success: true, settings });
};
