// Mirrors the frontend's src/types and src/constants/options.ts.
export const EVENT_CATEGORIES = [
  'Conference',
  'Wedding',
  'Corporate',
  'Concert',
  'Exhibition',
  'Seminar',
  'Gala',
  'Workshop',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_STATUSES = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Events in these states accept check-ins at the door. */
export const SCANNABLE_EVENT_STATUSES: EventStatus[] = ['upcoming', 'ongoing'];

export const QR_TYPES = ['standard', 'secure', 'branded'] as const;
export type QrType = (typeof QR_TYPES)[number];

export const INVITEE_CATEGORIES = ['VIP', 'Guest', 'Speaker', 'Sponsor', 'Media', 'Staff'] as const;
export type InviteeCategory = (typeof INVITEE_CATEGORIES)[number];

export const RSVP_STATUSES = ['pending', 'accepted', 'declined'] as const;
export const EMAIL_STATUSES = ['not_sent', 'sent', 'failed'] as const;
/** checked_in means the ticket has been used. */
export const CHECK_IN_STATUSES = ['not_checked_in', 'checked_in'] as const;

export const EMAIL_TEMPLATE_IDS = ['blank', 'elegant', 'modern', 'celebration'] as const;
export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export const SCAN_RESULTS = [
  'valid', // ticket accepted and marked used
  'already_used', // ticket was used before
  'invalid', // unknown code or bad signature
  'wrong_event', // real ticket, but for another event
  'event_closed', // event is draft / completed / cancelled
] as const;
export type ScanResult = (typeof SCAN_RESULTS)[number];
