# Mini Ticket Tracker

A full-stack support ticket tracking application built for the Lodwar Services mid-level full-stack take-home assignment.

**Stack:** Node.js · Express · TypeScript · PostgreSQL · React · Vite · TypeScript

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **PostgreSQL** 14 or higher (running locally)

---

## Database Setup

1. Create the database:

```bash
psql -U postgres -c "CREATE DATABASE tickets_db;"
```

2. Connect to it and run the schema:

```sql
CREATE TABLE tickets (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(20)  NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','in_progress','closed')),
  priority    VARCHAR(10)  NOT NULL DEFAULT 'medium'
                CHECK (priority IN ('low','medium','high')),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

Or run it directly:

```bash
psql -U postgres -d tickets_db -c "
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);"
```

---

## Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL to your PostgreSQL connection string
npm install
npm run dev
```

The API starts on **http://localhost:3001**.

### Environment variables (`.env`)

```
DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/tickets_db
PORT=3001
TEST_DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/tickets_test_db
```

---

## Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The app opens on **http://localhost:5173**. The Vite dev server proxies all `/tickets` requests to the backend at port 3001 — no CORS issues in development.

---

## API Reference

### `POST /tickets`
Create a new ticket.

**Body:**
```json
{ "title": "Login broken", "description": "Optional", "priority": "high" }
```
**Response `201`:**
```json
{ "id": 1, "title": "Login broken", "description": "Optional", "status": "open", "priority": "high", "created_at": "..." }
```

---

### `GET /tickets`
List tickets with optional status filter and pagination.

**Query params:** `status` (open | in_progress | closed), `page` (default 1), `limit` (default 10, max 100)

```
GET /tickets?status=open&page=1&limit=10
```

**Response `200`:**
```json
{ "data": [...], "total": 42, "page": 1, "limit": 10 }
```

---

### `PATCH /tickets/:id`
Update a ticket's status and/or priority. At least one field required.

**Body:**
```json
{ "status": "in_progress" }
```
**Response `200`:** updated ticket object. `404` if ticket not found.

---

### `GET /tickets/stats`
Count of tickets grouped by status.

**Response `200`:**
```json
{ "open": 5, "in_progress": 2, "closed": 10 }
```

---

## Running Tests

Tests use a separate database to avoid touching development data.

```bash
# Create the test database once
psql -U postgres -c "CREATE DATABASE tickets_test_db;"

# Run tests
cd backend
TEST_DATABASE_URL=postgres://postgres:yourpassword@localhost:5432/tickets_test_db npm test
```

**On Windows (PowerShell):**
```powershell
$env:TEST_DATABASE_URL="postgres://postgres:yourpassword@localhost:5432/tickets_test_db"
npm test
```

The test suite automatically creates the schema and truncates the table between tests — no manual setup beyond creating the database.

There are 7 test cases across 4 `describe` blocks covering:
- `POST /tickets` — create a ticket, missing title returns 400
- `GET /tickets/stats` — correct shape with numeric counts
- `GET /tickets` — status filter, pagination with total/page/limit
- `PATCH /tickets/:id` — status update, 404 for non-existent ticket

---

## Decisions & Tradeoffs

**No ORM.** I used the `pg` driver directly with parameterised queries. For a project this size, an ORM adds abstraction without much benefit — plain SQL keeps the data layer readable and the query intent explicit. With more time and a growing schema I'd reach for Prisma.

**No authentication.** Auth is out of scope for this assignment. In production I'd add JWT-based auth, per-user ticket ownership, and role-based access control for status/priority changes.

**Single-page UI without routing.** All three features (stats bar, create form, ticket list) live on one page. React Router would add value once there are multiple resources, but it isn't warranted here.

**Pagination kept simple.** The API returns `{ data, total, page, limit }` with offset-based pagination. Cursor-based pagination is more efficient at scale but adds complexity not justified for this scope.

**Test database isolation.** Tests run against a dedicated `tickets_test_db` and truncate the table in `beforeEach` blocks so every test starts from a known state. This avoids mocking the database entirely and keeps tests close to real behaviour.

**No migration tool.** Schema is a single `CREATE TABLE` statement. With more time I'd add a migrations tool (Flyway or `node-pg-migrate`) so schema changes are versioned and reproducible across environments.

**Assumptions made.** The assignment didn't specify whether `priority` should be settable at creation — I included it as an optional field defaulting to `medium`. I also chose to allow `PATCH` to update both `status` and `priority` in one call rather than two separate endpoints, since the assignment says "update a ticket's status or priority."

**What I'd do differently with more time:** add a migrations system, introduce React error boundaries and a proper loading/error state pattern, add end-to-end tests with Playwright, implement optimistic UI updates for the status dropdown, add structured logging with `pino` on the backend, and containerise the whole stack with Docker Compose for easier onboarding.

---

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── app.ts               # Express app (no listen — importable by tests)
│   │   ├── server.ts            # Entry point — calls app.listen
│   │   ├── db.ts                # pg Pool configured from DATABASE_URL
│   │   ├── routes/
│   │   │   └── tickets.ts       # All 4 endpoints
│   │   └── __tests__/
│   │       └── tickets.test.ts  # 7 integration tests
│   ├── .env.example
│   ├── jest.config.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Single-page UI
│   │   └── App.css
│   ├── .env.example
│   ├── vite.config.ts           # Proxies /tickets → localhost:3001
│   └── package.json
├── .gitignore
└── README.md
```
