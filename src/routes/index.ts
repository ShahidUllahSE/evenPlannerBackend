import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import * as events from '../controllers/event.controller';
import * as invitees from '../controllers/invitee.controller';
import * as scans from '../controllers/scan.controller';
import * as settings from '../controllers/settings.controller';
import * as users from '../controllers/user.controller';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { loginLimiter, scanLimiter } from '../middleware/rateLimit.middleware';
import { validateBody } from '../middleware/validate.middleware';
import { changePasswordSchema, loginSchema, updateProfileSchema } from '../validators/auth.schema';
import { sendEmailSchema } from '../validators/email.schema';
import {
  assignScannersSchema,
  createEventSchema,
  qrTypeSchema,
  updateEventSchema,
} from '../validators/event.schema';
import {
  bulkDeleteSchema,
  importInviteesSchema,
  inviteeInputSchema,
  updateInviteeSchema,
} from '../validators/invitee.schema';
import { scanSchema } from '../validators/scan.schema';
import { updateMailSettingsSchema, updateTwilioSettingsSchema } from '../validators/settings.schema';
import { createUserSchema, updateUserSchema } from '../validators/user.schema';

const router = Router();
const managers = requireRole('admin', 'planner');
const admins = requireRole('admin');

router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

// Auth
router.post('/auth/login', loginLimiter, validateBody(loginSchema), auth.loginController);

router.use(authenticate);

router.get('/auth/me', auth.meController);
router.patch('/auth/me', validateBody(updateProfileSchema), auth.updateProfileController);
router.patch('/auth/password', validateBody(changePasswordSchema), auth.changePasswordController);

// Mail settings: admin-only override of SMTP credentials (falls back to .env)
router.get('/settings/mail', admins, settings.getMailSettingsController);
router.put('/settings/mail', admins, validateBody(updateMailSettingsSchema), settings.updateMailSettingsController);
router.delete('/settings/mail', admins, settings.clearMailSettingsController);

// Twilio settings: admin-only override (falls back to .env)
router.get('/settings/twilio', admins, settings.getTwilioSettingsController);
router.put(
  '/settings/twilio',
  admins,
  validateBody(updateTwilioSettingsSchema),
  settings.updateTwilioSettingsController,
);
router.delete('/settings/twilio', admins, settings.clearTwilioSettingsController);

// Accounts: admin manages everyone, planners manage their own scanners
router.get('/users', managers, users.listUsersController);
router.post('/users', managers, validateBody(createUserSchema), users.createUserController);
router.get('/users/:id', managers, users.getUserController);
router.patch('/users/:id', managers, validateBody(updateUserSchema), users.updateUserController);
router.delete('/users/:id', managers, users.deleteUserController);

// Dashboard (scoped per role)
router.get('/dashboard', scans.dashboardController);

// Events: scanners can list the events they are assigned to
router.get('/events', events.listEventsController);
router.post('/events', managers, validateBody(createEventSchema), events.createEventController);
router.get('/events/:id', events.getEventController);
router.patch('/events/:id', managers, validateBody(updateEventSchema), events.updateEventController);
router.delete('/events/:id', managers, events.deleteEventController);
router.get('/events/:id/stats', managers, events.eventStatsController);
router.get('/events/:id/scanners', managers, events.listEventScannersController);
router.put('/events/:id/scanners', managers, validateBody(assignScannersSchema), events.assignScannersController);

// Guests of an event
router.get('/events/:id/invitees', managers, events.listEventInviteesController);
router.post('/events/:id/invitees', managers, validateBody(inviteeInputSchema), events.addInviteeController);
router.post(
  '/events/:id/invitees/import',
  managers,
  validateBody(importInviteesSchema),
  events.importInviteesController,
);
router.post('/events/:id/qr/regenerate', managers, validateBody(qrTypeSchema), events.regenerateQrController);

// Invitation emails
router.post('/events/:id/emails', managers, validateBody(sendEmailSchema), events.sendEmailsController);
router.get('/events/:id/emails', managers, events.listEventEmailLogsController);
router.get('/email-logs', managers, invitees.listEmailLogsController);

// Guests across events
router.get('/invitees', managers, invitees.listInviteesController);
router.patch('/invitees/:id', managers, validateBody(updateInviteeSchema), invitees.updateInviteeController);
router.delete('/invitees/:id', managers, invitees.deleteInviteeController);
router.post('/invitees/bulk-delete', managers, validateBody(bulkDeleteSchema), invitees.bulkDeleteInviteesController);

// Door scanning: any role, limited to events the user can see
router.post('/scans', scanLimiter, validateBody(scanSchema), scans.scanController);
router.get('/scans', scans.listScanLogsController);

export default router;
