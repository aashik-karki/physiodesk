# PhysioDesk

Clinic management for a physiotherapy practice: patients, therapist schedules, appointment booking, billing and a live dashboard.

| | |
|---|---|
| **Backend** | Python 3.12 · FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL 16 · JWT auth |
| **Frontend** | Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · TanStack Query |
| **Tests** | pytest, 72 tests against a real Postgres database |

## Test logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@physiodesk.dev` | `Admin@123` |
| Staff (receptionist) | `staff@physiodesk.dev` | `Staff@123` |

The seed also creates 4 therapists, 16 patients, ~3 weeks of appointments (past, today and upcoming) and ~70 invoices, all dated relative to today, so the demo always looks live.

---

## Run it

### Option A: one command (Docker)

```bash
docker compose up --build
```

- App: http://localhost:3000
- API docs (Swagger): http://localhost:8000/docs

The backend container runs `alembic upgrade head`, then `python -m app.seed`, then starts the API. Postgres is exposed on host port **5434** (5432 is often taken by a local install).

### Option B: run locally (for development)

**1. Database**

```bash
docker compose up -d db
```

**2. Backend** (`backend/`)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set JWT_SECRET
alembic upgrade head            # build the schema from scratch
python -m app.seed              # demo data (safe to re-run)
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

**3. Frontend** (`frontend/`)

```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

The frontend proxies `/api/*` to the backend (`next.config.ts`). Set `API_URL` in `frontend/.env.local` if the API isn't on `http://localhost:8000`.

### Environment variables (backend)

| Variable | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://physiodesk:physiodesk@localhost:5434/physiodesk` | required |
| `JWT_SECRET` | output of `python -c "import secrets; print(secrets.token_urlsafe(48))"` | required |
| `CLINIC_TIMEZONE` | `Asia/Kathmandu` | what "today" means for the dashboard and schedule |
| `COOKIE_SECURE` | `false` | set `true` when served over HTTPS |
| `CORS_ORIGINS` | `http://localhost:3000` | only needed if calling the API cross-origin |

### Tests

Tests run against real Postgres, because the most important rules (no overlapping bookings, money constraints) are database constraints. The schema is built by the real Alembic migrations, so the tests also prove the migrations work.

```bash
docker compose exec db createdb -U physiodesk physiodesk_test   # once
cd backend && pytest     # refuses to run unless the database name ends in _test
```

---

## Features

| Area | Highlights |
|---|---|
| **Auth** | Login, short-lived access token plus httpOnly refresh cookie, silent refresh, refresh-token rotation with reuse detection, logout and logout-everywhere |
| **Dashboard** | Patients today, therapists on duty, revenue today, open slots left, a capacity meter per therapist, the next appointments, and recently registered patients. Computed live and refreshed every minute |
| **Patients** | Search by name or phone (formatting ignored), filter dropdowns for therapist and status, pagination, add/edit/delete modal, and a profile with session and billing history |
| **Schedule** | Day grid of therapists by time, open/booked/past slots, booking from a slot, reschedule, cancel, mark completed or no-show |
| **Therapists** | Roster table with search and specialty / on-duty-today filters, showing working days, hours, session length and patients today. Admin: add, edit, remove, and set a day off or custom hours for a specific date |
| **Billing** | Paid/Due/Void tabs with totals, search by patient, service or INV number. Admin: create (optionally from a package), edit, record payment, void. A printable invoice page (Print / Save as PDF) |

## Roles

| Area | Admin | Staff |
|---|---|---|
| Dashboard, Patients, Schedule | full | full |
| Billing | full | **read-only** (can view and print) |
| Therapists | full, including schedule exceptions | **read-only** (needed to book) |

Enforced on the server with a `require_roles(...)` dependency (403). The UI also hides actions a role can't take, but that's for convenience, not security.

## Architecture

```
backend/app/
  core/       settings, password hashing + JWT, domain errors -> HTTP codes
  db/         engine/session, declarative base (stable constraint names)
  models/     SQLAlchemy models + enums
  schemas/    Pydantic request/response models (the API contract)
  services/   business rules, no HTTP knowledge
  api/        thin routers + dependencies (current user, role guards)
  seed.py     demo data
frontend/src/
  app/        routes: (app)/ shares the sidebar layout; login/ and invoices/[id] don't
  components/ ui/ design-system primitives; feature folders per area
  lib/        api client (auth header, refresh-and-retry), auth context, query hooks, formatting
```

Routes validate input and call a service. Services raise `NotFoundError`, `ConflictError` or `BusinessRuleError`, and one handler maps them to 404, 409 or 422 with a `{"detail": "..."}` body, which the frontend shows as-is.

## Key decisions

**Double-booking is impossible, not just checked.** Two Postgres exclusion constraints (GiST on `tsrange(date + start, date + end)`) forbid any overlapping live appointment for the same therapist **or** the same patient. Cancelled rows don't count, and back-to-back bookings are fine. The service checks first, for friendly messages ("Bikash Rai already has an appointment 12:00-12:45 that day."), but the database is the guarantee: two receptionists clicking "Book" at the same moment can't both win. A test switches off the service check and proves the database still returns a clean 409.

**Slots are computed, not stored.** A therapist has working weekdays, hours and a session length. The slots for a date are generated from those, or from that date's override (a day off or custom hours). Changing hours changes future slots instantly, with nothing to regenerate.

**Schedule overrides can't strand bookings.** Setting a day off or shorter hours is rejected (409) if existing bookings would fall outside them; staff reschedule those first.

**Therapists are soft-deleted.** Removing one hides them from the roster and booking, and cancels only their *upcoming* appointments (the UI reports how many). Past appointments and invoices stay intact.

**Financial records are never erased.** Deleting an invoice voids it, which excludes it from totals but keeps it on record. Invoices keep a `patient_name` snapshot, so they survive patient deletion. `total` is a generated column (`amount - discount`); check constraints enforce `0 ≤ discount ≤ amount` and "`paid_at` is set exactly when status is paid". Money is `NUMERIC(10,2)`, never float.

**"Today" is clinic-local.** Dashboard and schedule dates use `CLINIC_TIMEZONE`, not the server's UTC clock (Kathmandu is UTC+5:45). The frontend does the same (`NEXT_PUBLIC_CLINIC_TIMEZONE`, default Asia/Kathmandu), so a reviewer in another country sees the clinic's day, not their own.

**Auth.** bcrypt (cost 12) password hashes, and a timing-equalised login so response time doesn't reveal which emails exist. The access token (15 min) lives in memory only, never `localStorage`. The refresh token (7 days) is an httpOnly, SameSite=Lax cookie scoped to `/api/auth`. Every refresh rotates it; replaying an old one revokes all of that user's sessions (with a 30-second grace window so two tabs refreshing at once don't log each other out). The user is reloaded on every request, so deactivation and role changes apply immediately.

## Design system

Colour tokens are defined once in `frontend/src/app/globals.css` (`@theme`), using the exact hex values from the brief. Some roles are renamed for readable class names: Background → `canvas`, Text Primary → `ink`, Text Secondary → `muted`, Primary Text-on-Soft → `primary-ink`. Status colours (success/danger/neutral) are used only for status pills and destructive actions. Fonts: Fraunces (headings), Inter (UI), IBM Plex Mono (numbers, times, IDs, money), loaded with `next/font`.

## Assumptions

- **"Patients today"** = distinct patients with a booked or completed appointment today (cancelled and no-show don't count). **"Revenue today"** = invoices marked paid today (clinic time).
- A slot length that doesn't divide the working day drops the leftover (09:00–10:00 with 45-min slots → one slot).
- Changing a therapist's weekly hours doesn't move existing bookings; ones that no longer fit are flagged in the grid with a warning icon.
- Bookings can't be made in the past. A session can be marked completed or no-show only once it has started. Status only moves forward from `booked`.
- An appointment can be billed once (voided invoices excepted). Patients on a package default to "Prepaid package" when booking.
- Deleting a patient removes their appointments but keeps their invoices.
- Staff have read-only billing and therapist access.

## With more time

- Server-side audit log (who booked, cancelled or voided what)
- A week view and drag-to-reschedule on the grid
- Package session tracking (sessions used vs remaining) and automatic invoicing on completion
- SMS/email reminders; a mobile-first layout for the front desk
- Rate limiting on `/auth/login`, and user management screens for admins
- CI running the test suite and type checks on every push
