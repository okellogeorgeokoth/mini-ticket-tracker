# Mini Ticket Tracker

A full-stack support ticket tracking application built with Node.js/Express/TypeScript, PostgreSQL, and React/Vite/TypeScript.

---

## Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **PostgreSQL** 14 or higher

---

## Database Setup

1. Create the database:

```sql
CREATE DATABASE tickets_db;
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

---

## Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection string:
# DATABASE_URL=postgres://user:password@localhost:5432/tickets_db
npm install
npm run dev
```

The API will start on **http://localhost:3001**.

### API Endpoints

| Method | Path              | Description                            |
|--------|-------------------|----------------------------------------|
| POST   | /tickets          | Create a ticket                        |
| GET    | /tickets          | List tickets (supports `?status=`, `?page=`, `?limit=`) |
| PATCH  | /tickets/:id      | Update a ticket's status or priority   |
| GET    | /tickets/stats    | Count of tickets grouped by status     |

---

## Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The app will open on **http://localhost:5173**. The Vite dev server proxies `/tickets` requests to the backend at port 3001.

---

## Running Tests

The tests require a separate test database to avoid touching your development data.

```bash
# Create the test database (run once)
psql -U your_user -c "CREATE DATABASE tickets_test_db;"

# Set the test database URL and run tests
cd backend
TEST_DATABASE_URL=postgres://user:password@localhost:5432/tickets_test_db npm test
```

On Windows (PowerShell):

```powershell
$env:TEST_DATABASE_URL="postgres://user:password@localhost:5432/tickets_test_db"
npm test
```

The test suite creates and truncates the schema automatically — no manual setup required beyond creating the database.

---

## Decisions & Tradeoffs

**No ORM**: I used the `pg` driver directly with parameterised queries. For a project of this size an ORM would add abstraction without much benefit, and plain SQL keeps the data layer easy to read and debug.

**No authentication**: Auth is out of scope for this assignment. In production I'd add JWT-based authentication and per-user ticket ownership, plus role-based access for priority and status changes.

**Single-page UI without routing**: All features (stats, create form, ticket list) live on one page. Adding React Router would be straightforward, but it isn't necessary when the scope is a single resource.

**Pagination kept simple**: The API returns `{ data, total, page, limit }` and the frontend does page-by-page navigation. Cursor-based pagination would be more efficient at scale but adds complexity not warranted here.

**Test database isolation**: Tests run against a separate database (`tickets_test_db`), and the suite truncates the table in `beforeEach` blocks so each test starts from a known state. This avoids mocking the database and keeps tests closer to real behaviour.

**No migration tool**: Schema is a single `CREATE TABLE` statement. With more time I'd add a tool like `db-migrate` or `Flyway` so schema changes are versioned and repeatable across environments.

**What I'd do differently with more time**: Add a migrations system, introduce proper error boundary components in React, add end-to-end tests with Playwright, implement optimistic UI updates for the status dropdown, and add proper logging (e.g. pino) on the backend instead of `console.error`.
