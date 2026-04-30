# LexManager — Product Requirements (MVP v1)

## Overview
LexManager is a practice management app for solo Indian lawyers. Built on Expo (React Native + Web PWA-compatible) frontend with FastAPI + MongoDB backend. Monochrome Swiss design; Indian legal context throughout (Saket Court, Tis Hazari, ₹, GSTIN, Bar Council No.).

## What's in v1 (shipped)
- **Auth:** Email + password (JWT, bcrypt). Register auto-creates account; seeded demo data via `/api/seed-demo`.
- **Dashboard:** Greeting + date, stat grid (active matters / unbilled / overdue / hearings this week), today's hearings, quick actions, upcoming deadlines, outstanding invoices.
- **Clients:** List + search + status filters, conflict-of-interest check on name input, full CRUD, client detail with matters list.
- **Matters:** List + search + filters, CRUD, 5-tab detail (Overview / Notes / Timeline / Time / Billing), per-matter stats (hours, unbilled, billed, paid).
- **Calendar:** Agenda view grouped by date (Today / Tomorrow / Day-of-week / date), event types: hearing / deadline / appointment / task.
- **Time tracking:** Manual entry with activity pills (hearing, drafting, research, client_call, travel, other), billable toggle, auto-calc of billed amount.
- **Billing:** Invoice list + status filters, creation pulls unbilled time + custom items, GST 18% toggle, mark-as-paid, full invoice detail.
- **Settings:** Profile (name, Bar Council No., city, chamber), billing defaults (GSTIN, hourly rate), logout.

## Tech stack
- Frontend: Expo Router, React Native (web-compatible for PWA use), TypeScript, AsyncStorage for JWT, Ionicons.
- Backend: FastAPI, motor (async MongoDB), pyjwt, bcrypt.
- Database: MongoDB (collections: users, clients, matters, events, time_entries, invoices, notes).
- Design: Swiss high-contrast monochrome (`#09090B` ink on `#FFFFFF`), 1px borders, Grid Border pattern, no shadows.

## What's explicitly deferred (V2+)
- AI features (voice notes via Whisper, Claude drafting/extraction).
- WhatsApp Business API integration.
- Razorpay payment collection.
- Document management (file uploads, PDF viewer).
- Drafting Studio (TipTap editor, templates, clause library).
- Offline sync (Dexie.js + service worker).
- Phone OTP auth.
- Hindi UI.

## Smart business enhancement
**Conflict-of-interest check as a live field** — as the lawyer types a client name during creation, the app queries existing clients and surfaces a red banner of potential matches. This is an ethical compliance feature unique to legal practice and a genuine differentiator versus generic CRMs.

## Key endpoints
- `POST /api/auth/register`, `/api/auth/login`, `GET/PUT /api/auth/me`
- `GET/POST/PUT/DELETE /api/clients`, `GET /api/clients/conflict-check`
- `GET/POST/PUT/DELETE /api/matters`
- `GET/POST/PUT/DELETE /api/events`
- `GET/POST/DELETE /api/time-entries`
- `GET/POST /api/invoices`, `POST /api/invoices/{id}/payment`
- `GET/POST/DELETE /api/notes`
- `GET /api/dashboard/stats`
- `POST /api/seed-demo` (idempotent)

## Test credentials
`demo@lex.in` / `demo1234` — seeded with 5 clients, 5 matters, 7 events, 5 time entries, 2 invoices in Indian legal context.
