# Resource Reservation Management System (RRSM)

A modern full-stack web application designed to manage shared organizational resources (rooms, vehicles, hardware) with mathematical conflict prevention, timezone-aware scheduling, role-based workflows, and administrative oversight.

---

## 1. Description & Problem Solved

Organizations frequently struggle with double-bookings, timezone confusion, manual approval bottlenecks, and lack of utilization visibility when sharing high-demand assets like conference rooms, company vehicles, and presentation equipment.

**The Solution:** RRSM guarantees zero double-bookings using PostgreSQL-level exclusion constraints, standardizes all user scheduling to the organization's business timezone (`Asia/Colombo`, UTC+05:30) while persisting records in UTC, enforces role segregation (administrators manage; members reserve), and delivers immediate real-time availability timelines and aggregated usage analytics.

---

## 2. Features by Role

### Member Features
- **Account Registration & Self-Service:** Register for an account; access is held in `PENDING` status until verified and approved by an administrator.
- **Resource Catalog & Filtering:** Search and browse active resources with category filters, capacity indicators, location details, and descriptions.
- **Availability Timeline:** Inspect visual daily timeline slots (08:00 to 20:00) showing booked and free windows for any selected date.
- **Find Free Resources:** Search for available resources by date, start time, end time, and category.
- **Reservation Booking:** Reserve resources in 15-minute slot increments (minimum 30 minutes, maximum 8 hours, up to 30 days in advance) with purpose details.
- **My Reservations:** View upcoming scheduled bookings and past/cancelled reservation history; self-cancel upcoming reservations.
- **Privacy Enforcement:** Member views show timeline occupancy blocks without revealing other users' booking purposes or personal identities.

### Administrator Features (Managers Only)
> **Note on Role Segregation:** Administrators manage the system and do **not** make reservations or use member booking pages.
- **User Management:** Review pending member registrations; approve or reject applicants; disable or re-enable existing accounts; promote or demote members to/from the admin role.
- **Resource Management:** Create, edit, and toggle active/inactive status for resources. (Resources are soft-deactivated, never hard-deleted).
- **Category Management:** Create and edit resource categories; delete empty categories (deletion is rejected if resources are assigned).
- **All Reservations Oversight:** Search, filter, and review all organizational reservations with user and resource details; cancel any upcoming reservation with administrative authority.
- **Usage Overview Dashboard:** High-level analytics showing 30-day confirmed reservation counts, total booked hours, distinct active bookers, top-utilized resources, and category breakdown.

---

## 3. Tech Stack

- **Next.js 16.4.0 (App Router & Turbopack):** Modern server-side rendering, React Server Components (RSC), and type-safe server actions.
- **React 19.3.0:** Latest React core runtime with React Compiler optimizations.
- **TypeScript 5.x:** Strict static typing across models, services, actions, and UI components.
- **PostgreSQL 16+ with `btree_gist`:** Reliable relational database engine providing exclusion constraints (`tstzrange`) for overlap prevention.
- **Prisma ORM 6.19.3:** Type-safe database queries, schema migrations, and client generation.
- **Custom Stateless JWT Auth (`jose` 6.2.12 + `bcryptjs` 3.0.3):** HttpOnly session cookie authentication with database-verified status checks on every request.
- **Zod 4.6.6:** Strict schema validation for all client inputs and server actions.
- **Tailwind CSS 4.3.3 & shadcn/ui:** Clean, responsive design with accessible Radix-based UI components.
- **date-fns 4.4.0 & date-fns-tz 3.2.0:** Deterministic timezone conversions (`Asia/Colombo` UTC+05:30 <-> UTC).

---

## 4. Prerequisites

- **Node.js:** v20.x or higher (tested on Node v24.20.0)
- **npm:** v10.x or higher
- **PostgreSQL:** Local installation of PostgreSQL 14, 15, or 16 running on port `5432` (or Docker).

---

## 5. Local Setup (Copy-Pasteable)

### Step 1: Clone and Install
```bash
git clone <repository-url>
cd rrsm
npm install
```

### Step 2: Create Local Database
Create a PostgreSQL database named `reservations` using `psql`:
```bash
psql -U postgres -c "CREATE DATABASE reservations;"
```
*(Alternative: Open pgAdmin, right-click "Databases" -> "Create" -> "Database...", and enter `reservations`).*

### Step 3: Configure Environment Variables
Copy `.env.example` to create `.env`:
```bash
# On Linux / macOS / Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

Open `.env` and configure the variables:
- `DATABASE_URL`: Connection string pointing to your PostgreSQL instance:
  ```env
  DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/reservations"
  ```
- `AUTH_SECRET`: A secure 32-byte base64-encoded secret for signing session JWT tokens. Generate a fresh one using:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- `SEED_ADMIN_EMAIL`: Initial administrator email populated during seeding (e.g., `admin@example.com`).
- `SEED_ADMIN_PASSWORD`: Initial administrator password (e.g., `AdminPassword123!`).
- `APP_TIMEZONE`: Timezone for all organizational scheduling (`Asia/Colombo`).

### Step 4: Apply Database Migrations
Run the migration deploy command to execute all migrations in `prisma/migrations` against the database:
```bash
npx prisma migrate deploy
```
*(In an active development cycle when modifying schema definitions, use `npm run db:migrate` instead).*

### Step 5: Seed Demo Data
Populate the database with the initial admin, member accounts, categories, sample resources, and initial reservations:
```bash
npm run db:seed
```

### Step 6: Start the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser. Verify database connectivity at [http://localhost:3000/api/health](http://localhost:3000/api/health).

---

## 6. Docker Option (Optional, Not Verified)

A `docker-compose.yml` file is provided in the repository to spin up a containerized PostgreSQL instance on port `5433`:
```bash
# Start container (unverified in this environment)
npm run db:up

# Stop container
npm run db:down
```
If using Docker, configure `.env` with:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reservations"
```
> **Notice:** The Docker workflow is provided as an optional convenience and has not been verified in this environment. The local PostgreSQL setup (Section 5) is the primary verified target.

---

## 7. Demo Accounts

The database seed creates the following demonstration accounts (passwords are for local development only):

| Name | Email | Password | Role | Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **System Admin** | `admin@example.com` *(or `SEED_ADMIN_EMAIL`)* | `AdminPassword123!` *(or `SEED_ADMIN_PASSWORD`)* | `ADMIN` | `ACTIVE` | System manager; oversees users, resources, and reservations |
| **Alice Johnson** | `alice@example.com` | `Member@123` | `MEMBER` | `ACTIVE` | Active member; can search and reserve resources |
| **Bob Smith** | `bob@example.com` | `Member@123` | `MEMBER` | `ACTIVE` | Active member |
| **Charlie Brown** | `charlie@example.com` | `Member@123` | `MEMBER` | `ACTIVE` | Active member |
| **Diana Prince** | `diana@example.com` | `Member@123` | `MEMBER` | `PENDING` | Newly registered member awaiting administrator approval |

---

## 8. Walkthrough: How to Try the System

1. **Test Registration & Approval:**
   - Go to [http://localhost:3000/register](http://localhost:3000/register) and register a new user (e.g., `eve@example.com`).
   - Try logging in immediately: the system informs you that your account is `PENDING` administrator approval.
   - Log in as the Admin (`admin@example.com` / `AdminPassword123!`).
   - Navigate to **Users** in the top navigation bar, locate the pending user, and click **Approve**.
2. **Book a Resource as Member:**
   - Log out, then log in as an approved member (`alice@example.com` / `Member@123`).
   - Browse the resource catalog at `/resources`. Select "Executive Boardroom".
   - View the day's timeline and pick an open slot (e.g., tomorrow 10:00 to 11:30). Enter a purpose and submit.
   - The booking appears on your `/my-reservations` page.
3. **Attempt an Overlapping Booking (Conflict Prevention):**
   - Log out and log in as another member (`bob@example.com` / `Member@123`).
   - Try to book "Executive Boardroom" for an overlapping interval (e.g., tomorrow 10:30 to 12:00).
   - The reservation is immediately blocked with a clear conflict warning ("This resource is already booked for that time window").
4. **Availability Search:**
   - Click **Find Available** on `/resources`.
   - Enter a target date and time range to see only resources that are completely free during that window.
5. **Admin Oversight & Analytics:**
   - Log in as Admin.
   - Navigate to **Dashboard** (`/admin`) to inspect 30-day reservation stats, utilization hours, and top-booked resources.
   - Navigate to **Reservations** (`/admin/reservations`) to search and filter organizational bookings by date, resource, user, or status.

---

## 9. Key Design Decisions

1. **PostgreSQL Exclusion Constraint (`btree_gist`):** Double-booking prevention is enforced inside PostgreSQL via `EXCLUDE USING gist (resource_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status = 'CONFIRMED')`. Application-level check-then-insert is prone to race conditions under concurrent requests; database-level exclusion makes double-booking physically impossible.
2. **UTC Storage with Fixed Application Timezone:** All timestamps are converted to UTC via `toUtc()` upon submission and stored in UTC in PostgreSQL. All UI rendering uses `APP_TIMEZONE` (`Asia/Colombo`, UTC+05:30) via `formatInAppTimezone()`, eliminating discrepancies across client browsers and server runtime zones.
3. **Soft States Over Hard Deletes:** Resources and categories are never destructively deleted if historic or active associations exist. Resources feature an `isActive` toggle; categories cannot be deleted if any resource references them; reservations transition from `CONFIRMED` to `CANCELLED`.
4. **Manager-Only Administrators:** System administrators manage users, resources, categories, and reservations, but cannot create bookings or access member pages.
5. **Database-Verified Sessions on Every Request:** Although JWT session tokens are stateless, `getCurrentUser()` verifies the user's active status and role against the database on every protected request. Disabling a user or altering a role takes effect instantaneously without waiting for token expiration.
6. **Strict Server-Side Role & Identity Enforcement:** User identity (`userId`) and role (`ADMIN` / `MEMBER`) are never accepted from client form inputs; they are strictly extracted from the authenticated session.
7. **Privacy-Preserving Timelines:** While administrators can audit all booking purposes and identities, member availability timelines show reserved slots as anonymized "Booked" blocks.
8. **SQL-Aggregated Usage Statistics:** Dashboard analytics execute single-pass SQL aggregations using parameterized `prisma.$queryRaw` rather than loading thousands of reservation rows into Node.js memory.

---

## 10. Database Schema

The database consists of 4 primary relational tables defined in `prisma/schema.prisma`:
- **`User`:** Stores user credentials (`passwordHash`), role (`ADMIN`, `MEMBER`), status (`PENDING`, `ACTIVE`, `DISABLED`), and administrator approval metadata (`approvedById`, `approvedAt`).
- **`ResourceCategory`:** Organizational classification for assets (name, description).
- **`Resource`:** Shared assets with name, category reference (`categoryId`), location, capacity, description, and active status (`isActive`).
- **`Reservation`:** Booking records linking `resourceId`, `userId`, `startTime`, `endTime`, `purpose`, and `status` (`CONFIRMED`, `CANCELLED`).

**ER Diagram:** <ADD SHAREABLE LINK HERE>

*(Note: The schema is maintained in `prisma/schema.prisma`. The PostgreSQL exclusion constraint for overlap prevention is defined in migration `prisma/migrations/20261012082154_add_reservation_constraints/migration.sql`).*

---

## 11. Available Scripts

All scripts defined in `package.json`:

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `next dev` | Start the Next.js development server with Turbopack |
| `npm run build` | `next build` | Build the optimized production application |
| `npm run start` | `next start` | Run the compiled production application server |
| `npm run lint` | `eslint` | Run ESLint checks across the codebase |
| `npm run db:up` | `docker compose up -d` | Start the optional Docker PostgreSQL container |
| `npm run db:down` | `docker compose down` | Stop the optional Docker PostgreSQL container |
| `npm run db:migrate` | `prisma migrate dev` | Apply migrations during development |
| `npm run db:seed` | `prisma db seed` | Seed demo accounts, categories, resources, and bookings |
| `npm run db:reset` | `prisma migrate reset` | Drop the database, re-run all migrations, and seed |
| `npm run db:studio` | `prisma studio` | Open Prisma Studio GUI for exploring database records |
| `npm run db:verify` | `tsx scripts/verify-constraints.ts` | Verify PostgreSQL exclusion constraints against concurrent overlaps |
| `npm run auth:verify` | `tsx scripts/verify-auth.ts` | Verify authentication, hashing, and token verification flows |
| `npm run admin:verify` | `tsx scripts/verify-admin.ts` | Verify administrative user management workflows |
| `npm run db:verify:admin` | `tsx scripts/verify-admin.ts` | Alias for admin verification script |
| `npm run resources:verify`| `tsx scripts/verify-resources.ts`| Verify category and resource validation rules |
| `npm run db:verify:reservations` | `tsx scripts/verify-reservations.ts` | Verify reservation booking, slot granularity, and constraints |
| `npm run db:verify:availability` | `tsx scripts/verify-availability.ts` | Verify availability timeline and free-window search logic |
| `npm run db:verify:roles` | `tsx scripts/verify-roles.ts` | Verify manager-only admin rules and role change enforcement |

---

## 12. Project Structure

```text
rrsm/
├── prisma/
│   ├── migrations/          # SQL migration files (including exclusion constraints)
│   ├── schema.prisma        # Prisma data models and relations
│   └── seed.ts              # Idempotent database seeding script
├── public/                  # Static assets and icons
├── scripts/                 # Standalone verification and integration test scripts
├── src/
│   ├── app/                 # Next.js App Router routes & layouts
│   │   ├── (admin)/         # Admin route group (/admin, categories, resources, users)
│   │   ├── (app)/           # Member route group (/resources, /my-reservations, /availability)
│   │   ├── (auth)/          # Authentication routes (/login, /register)
│   │   ├── api/health/      # Health check endpoint
│   │   ├── error.tsx        # Route segment error boundary
│   │   ├── global-error.tsx # Root layout crash boundary
│   │   ├── not-found.tsx    # 404 page
│   │   └── forbidden/       # 403 Forbidden page
│   ├── components/          # Reusable UI components, tables, dialogues, and navigation
│   ├── lib/                 # Core utilities, DB client, auth tokens, time helpers
│   │   ├── db.ts            # Prisma client singleton
│   │   ├── reservation-rules.ts # Core business rules (duration, advance limits, slot size)
│   │   ├── time.ts          # Asia/Colombo timezone conversion functions
│   │   ├── session.ts       # Authentication session extraction and role assertions
│   │   └── db-errors.ts     # PostgreSQL error classification (exclusion error detection)
│   └── services/            # Business logic and database query layer
│       ├── auth.ts          # Credential verification
│       ├── users.ts         # User registration and admin approval operations
│       ├── resources.ts     # Resource and category operations
│       ├── reservations.ts  # Reservation creation and cancellation logic
│       ├── availability.ts  # Daily slot computation and free-window interval math
│       └── stats.ts         # Admin usage metrics and aggregations
├── docker-compose.yml       # Optional PostgreSQL container definition
├── next.config.ts           # Next.js configuration and security response headers
├── package.json             # Scripts and dependencies
└── tsconfig.json            # TypeScript configuration
```
> **Business Rules Location:** Numeric constraints (15-min slot granularity, 30-min minimum duration, 8-hour maximum duration, 30-day advance booking limit, timeline hours 08:00–20:00) reside in `src/lib/reservation-rules.ts`.

---

## 13. Assumptions, Limitations & Future Improvements

- **Email Verification & Reset:** Currently, users register and wait for administrator approval; automated email verification tokens and "Forgot Password" self-service flows can be added using a transactional email service (e.g., Resend).
- **Recurring Reservations:** Reservations are currently single discrete intervals; recurring weekly or monthly bookings could be introduced with bulk conflict detection.
- **Resource-Specific Rules:** Booking limits currently apply system-wide; per-resource custom availability hours or approval workflows would provide greater flexibility.
- **Calendar Synchronization:** Exporting confirmed bookings to iCal (.ics) or syncing directly with Google Calendar / Outlook.
- **Audit Logging:** Administrative actions (approvals, role alterations, cancellations) are tracked in entity tables; a dedicated append-only `AuditLog` table would offer comprehensive compliance history.
- **Login Rate Limiting:** Brute-force protection can be enhanced by introducing Redis-backed rate limiting on `/login`.

---

## 14. Troubleshooting

- **Port 5432 in use:**
  If port `5432` is occupied by another service or existing PostgreSQL instance, adjust the port in `DATABASE_URL` (or configure PostgreSQL's `postgresql.conf` to use an alternative port such as `5434`).
- **`psql` is not recognized on Windows:**
  Add the PostgreSQL `bin` directory (typically `C:\Program Files\PostgreSQL\<version>\bin`) to your system `PATH` environment variable, or use pgAdmin GUI to create the database.
- **Password authentication failed for user "postgres":**
  Double-check the credentials specified in `DATABASE_URL` within `.env`. Ensure the password matches what was configured during PostgreSQL installation.
- **`btree_gist` extension errors:**
  The second migration creates the `btree_gist` extension (`CREATE EXTENSION IF NOT EXISTS btree_gist;`). Ensure the PostgreSQL user has superuser privileges (default for `postgres`) to install extensions in the database.
