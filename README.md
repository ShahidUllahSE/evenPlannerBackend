# EventSphere Backend

REST API for the EventSphere event planner: accounts with three roles, events, guest lists, signed QR tickets, invitation emails and door check-in scanning with full tracking.

Stack: Node.js, Express 5, MongoDB (Mongoose), TypeScript, JWT, Nodemailer.

## Setup

```bash
npm install
cp .env.example .env      # then fill in the values
npm run seed:admin        # creates the first admin from ADMIN_* in .env
npm run dev               # http://localhost:5050/api
```

Production: `npm run build && npm start`.

`JWT_SECRET` and `QR_SECRET` must each be 32+ random characters:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Changing `QR_SECRET` invalidates every QR code already sent.

### Email

`MAIL_TRANSPORT=smtp` sends real email through any SMTP provider (Gmail with an app password, SendGrid, Mailgun, Amazon SES, etc.).
`MAIL_TRANSPORT=log` sends nothing and only prints recipients to the console, for local testing.

## Roles

| | Admin | Planner | Scanner |
|---|---|---|---|
| Accounts | Creates and manages every account | Creates and manages their own scanners | – |
| Events | All events | Only events they created | Only events they are assigned to (read only) |
| Guests, QR codes, email | All events | Their own events | – |
| Assign scanners | Any scanner to any event | Their own scanners to their own events | – |
| Scan tickets | Any event | Their own events | Assigned events |
| Scan history | Everything | Scans at their events | Their own scans |

Access is enforced on the server for every request. Events outside a user's scope return 404, so ids can't be probed.

## QR ticket lifecycle

1. The planner imports guests. Each gets a unique ticket code (`EP-7K3F-9QX2`) and a QR payload signed with HMAC-SHA256 (`QR_SECRET`).
2. The invitation email is sent with the QR embedded as an inline image. The guest's `emailStatus` becomes `sent` (or `failed`, with the error).
3. At the door, the scanner picks their event and scans. `POST /api/scans` checks the signature, the event, the scanner's assignment and the event status. A valid ticket is then flipped to used (`checkIn: "checked_in"`, `checkedInAt`, `checkedInBy`) in one atomic update, so two scanners can't admit the same ticket.
4. Every attempt, valid or not, is saved in the scan log with the event, planner, scanner, guest, result, time, IP and device.

Scan results: `valid`, `already_used` (with who and when), `invalid` (unknown or forged), `wrong_event`, `event_closed` (draft/completed/cancelled).

All three QR styles from the frontend are accepted (standard code, signed JSON, branded URL), plus a ticket code typed by hand.

## API

Every route except login and health needs `Authorization: Bearer <token>`. Responses are `{ success: true, ... }` or `{ success: false, message, details? }`.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/auth/me` | current user |
| PATCH | `/api/auth/me` | `{ name?, phone? }` |
| PATCH | `/api/auth/password` | `{ currentPassword, newPassword }` |

### Users (admin, planner)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/users?role=&q=` | admin: all; planner: own scanners |
| POST | `/api/users` | `{ name, email, password, role, phone? }` (planners may only create `scanner`) |
| GET / PATCH / DELETE | `/api/users/:id` | PATCH `{ name?, email?, password?, phone?, isActive? }` |

A planner who still owns events can't be deleted; deactivate them instead (`isActive: false`). Deactivation takes effect immediately, even for tokens already issued.

### Events
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/api/events?status=&plannerId=` | all | includes `stats: { guests, emailed, checkedIn }` |
| POST | `/api/events` | admin, planner | admin may pass `plannerId` to create for a planner |
| GET | `/api/events/:id` | all | |
| PATCH / DELETE | `/api/events/:id` | admin, owner | delete removes guests, email and scan logs |
| GET | `/api/events/:id/stats` | admin, owner | guests, RSVPs, email, check-ins, scans per result and per scanner |
| GET | `/api/events/:id/scanners` | admin, owner | |
| PUT | `/api/events/:id/scanners` | admin, owner | `{ scannerIds: [] }` replaces the list |

### Guests
| Method | Path | Notes |
|---|---|---|
| GET | `/api/events/:id/invitees?q=&checkIn=&emailStatus=` | one event |
| GET | `/api/invitees?eventId=&q=` | across all events in scope |
| POST | `/api/events/:id/invitees` | add one guest |
| POST | `/api/events/:id/invitees/import` | `{ rows: [...], qrType }` → `{ created, skipped }` |
| POST | `/api/events/:id/qr/regenerate` | `{ qrType }`; new codes, old QR codes stop working |
| PATCH | `/api/invitees/:id` | guest fields, `rsvp`, `checkIn` (manual check-in / undo) |
| DELETE | `/api/invitees/:id` | |
| POST | `/api/invitees/bulk-delete` | `{ ids: [] }` |

### Email
| Method | Path | Notes |
|---|---|---|
| POST | `/api/events/:id/emails` | `{ inviteeIds, subject, bodyHtml, templateId, includeQr }` → `{ sent, failed, log }` |
| GET | `/api/events/:id/emails` | email history for an event |
| GET | `/api/email-logs` | all email history in scope |

`subject` and `bodyHtml` support the frontend placeholders (`{{name}}`, `{{eventTitle}}`, `{{ticketCode}}`, ...). The layouts in `src/utils/emailTemplates.ts` are copied from the frontend, so keep the two in sync.

### Scanning and tracking
| Method | Path | Notes |
|---|---|---|
| POST | `/api/scans` | `{ eventId, payload }` → `{ valid, result, message, guest, checkedInAt, checkedInBy }` |
| GET | `/api/scans?eventId=&scannerId=&result=&page=&limit=` | scan history (scoped by role) |
| GET | `/api/dashboard` | headline numbers and recent scans (scoped by role) |

## Project layout

```
src/
  config/       env validation, DB connection
  constants/    roles and enums shared with the frontend
  models/       User, Event, Invitee, ScanLog, EmailLog
  middleware/   auth + role guard, validation, rate limits, errors
  validators/   zod request schemas
  services/     business logic and access rules
  controllers/  HTTP handlers
  routes/       route table
  utils/        QR signing/parsing, email templates, helpers
  scripts/      seedAdmin
```
