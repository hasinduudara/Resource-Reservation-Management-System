# Resource Reservation Management System

The Resource Reservation Management System is a modern full-stack web application designed to streamline and manage reservations for shared organizational resources, spaces, and equipment. Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, and Prisma ORM with PostgreSQL, the system provides real-time conflict prevention, timezone-aware scheduling, role-based access control, and intuitive management workflows.

## Getting Started

### Prerequisites
- Node.js (v18+ or v20+)
- npm
- Either a local PostgreSQL installation or Docker

---

### Option A: Local PostgreSQL Setup

1. **Create Database**: Ensure PostgreSQL is running locally and create a database named `reservations`:
   ```bash
   createdb reservations
   # or in psql:
   # CREATE DATABASE reservations;
   ```

2. **Configure Environment Variables**: Copy `.env.example` to `.env` and update your PostgreSQL credentials:
   ```bash
   cp .env.example .env
   ```
   Set `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/reservations"
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Verify**: Open [http://localhost:3000](http://localhost:3000) to view the application, and test [http://localhost:3000/api/health](http://localhost:3000/api/health) to verify database connectivity.

---

### Option B: Docker Setup (Optional)

If you do not have PostgreSQL installed locally, you can spin up the containerized PostgreSQL service:

1. **Start Database Container**:
   ```bash
   npm run db:up
   ```
   *(To stop the container later, run `npm run db:down`)*

2. **Configure Environment Variables**: Copy `.env.example` to `.env` and set the connection string to use port `5433` and password `postgres`:
   ```bash
   cp .env.example .env
   ```
   In `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/reservations"
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Verify**: Open [http://localhost:3000](http://localhost:3000) to view the application, and test [http://localhost:3000/api/health](http://localhost:3000/api/health) for database health status.
