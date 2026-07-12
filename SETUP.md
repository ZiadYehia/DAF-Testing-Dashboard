# Setup & Run Guide

This project is a Next.js app backed by **Microsoft SQL Server**. The QA content
(features, bugs, knowledge) ships inside the `data/` folder, but the **database
itself is not included** — you create it locally and load the data with one command.

---

## 1. Prerequisites

Install these first:

- **Node.js 20 or newer** — https://nodejs.org  (check with `node -v`)
- **A SQL Server database.** Easiest is **Docker Desktop** (https://www.docker.com/products/docker-desktop) — the project includes a ready-made MSSQL service. If you already run SQL Server / SQL Express locally, you can use that instead (see Option B).

> If the folder you received contains `node_modules/` or `.next/`, **delete both** before starting — they are machine-specific and must be rebuilt.

---

## 2. Configure environment

Copy the example env file and fill it in:

```bash
copy .env.example .env.local        # Windows (cmd)
# or:  cp .env.example .env.local    # macOS/Linux/Git Bash
```

Open `.env.local` and set at least:

```
# Database
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=Your_Strong_Pass123      # pick a strong password
DB_NAME=TestingDashboard
DB_SYNC=false                        # IMPORTANT: keep false (we use migrations)
DB_ENCRYPT=false

# Auth — generate a random secret:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=<paste generated secret>

# First admin login (used once, on db:seed-admin)
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_NAME=Admin
SEED_ADMIN_PASSWORD=ChangeMe_123

# AI / Jira keys are OPTIONAL — leave blank to run without them.
```

---

## 3. Start the database

### Option A — Docker (recommended)

The Docker MSSQL service reads `DB_PASSWORD` from `.env.local`, so set that first, then:

```bash
docker compose up -d db
```

Wait ~30s for it to become healthy, then create the (empty) database:

```bash
docker exec testing-dashboard-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Your_Strong_Pass123" -C -Q "IF DB_ID('TestingDashboard') IS NULL CREATE DATABASE [TestingDashboard]"
```

(Use the same password and DB name you put in `.env.local`.)

### Option B — Existing local SQL Server

Make sure SQL auth is enabled and the `sa` (or another) login works, then create the database with your SQL tool (SSMS / Azure Data Studio / sqlcmd):

```sql
IF DB_ID('TestingDashboard') IS NULL CREATE DATABASE [TestingDashboard];
```

Point `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` in `.env.local` at it.

---

## 4. Install, build the schema, load data, create admin

Run these from the project folder, in order:

```bash
npm install            # install dependencies
npm run db:migrate     # create all tables
npm run db:backfill    # load the data/ content (features, bugs, knowledge) into the DB
npm run db:seed-admin  # create the admin login from SEED_ADMIN_* in .env.local
```

---

## 5. Run it

```bash
npm run dev
```

Open **http://localhost:3000** and sign in with the `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` you set.

---

## Troubleshooting

- **"Login failed for user…" on sign-in** → wrong DB credentials, or `db:seed-admin`
  wasn't run (no admin exists yet).
- **`Invalid column name 'parentKey'`** → migrations didn't run; run `npm run db:migrate`.
- **`Cannot find module 'sonner'` / weird build errors** → stale install. Delete
  `node_modules/` and `.next/`, then `npm install` again. Also make sure there is no
  stray `package-lock.json` in a parent folder (e.g. your home directory).
- **`JavaScript heap out of memory` / process crashes while compiling** → the machine
  is low on RAM, usually from several `npm run dev` servers left running. Close other
  dev-server terminals (each one spawns many worker processes) and run just one.
- **Don't run `npm audit fix --force`** — it tries to downgrade Next.js and will break the app.

---

## Notes

- Keep the app's `data/` folder — that's where the QA content lives; `db:backfill`
  re-imports it into a fresh database.
- Uploaded app logos are stored in the database (not in `data/`), so they won't appear
  on a brand-new database until re-uploaded; emoji icons still show.
- For a fully containerized run (app + db together) you can use `docker compose up`,
  but you must still run the `db:migrate` / `db:backfill` / `db:seed-admin` steps once
  against the database.
