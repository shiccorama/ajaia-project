# Ajaia Collaborative Editor

A lightweight collaborative document editor with server-persisted rich-text documents,
owner/editor/viewer sharing, and `.txt` or Markdown import.

## Features

- Create, rename, edit, save, and reopen documents.
- Format text as bold, italic, underlined, headings, and bulleted or numbered lists.
- Import `.txt`, `.md`, and `.markdown` files up to 1 MB. The server validates and
  converts the file; uploaded HTML is not rendered as trusted content.
- See documents you own and documents shared with you.
- Share with a known workspace user as an editor or viewer. Owners manage access;
  viewers are read-only. The server enforces every permission.
- See saving, saved, and failed states. Failed saves can be retried, and the browser
  keeps a local draft for recovery on that device.

Document content is stored as structured TipTap-shaped JSON in PostgreSQL. The UI uses
the existing API routes in this repository; it does not provide live simultaneous editing.

## Current release status

The local development app and database have been checked. Typecheck, lint, the 35-test
suite, the Webpack production build, and the 25-check API smoke run pass. A full browser
acceptance walkthrough, external review, and live deployment are still required before
calling this a production release. See [docs/SUBMISSION.md](docs/SUBMISSION.md) for the
latest verification and open items.

## Requirements

- Node.js 20.11 or newer (the project was developed with Node.js 24)
- npm 10 or newer
- PostgreSQL 14 or newer
- Docker Desktop for the optional local PostgreSQL container

The checked-in `package-lock.json` supports reproducible installation with `npm ci`.

## Local setup

### 1. Install packages

From the project directory:

```powershell
npm ci
```

### 2. Start PostgreSQL

You can use an existing PostgreSQL server or start the local Docker container. The sample
configuration uses host port `15432` to avoid colliding with a local PostgreSQL on `5432`.
The Docker volume preserves data when the container restarts.

```powershell
docker run -d --name ajaia-pg `
  -e POSTGRES_USER=ajaia `
  -e POSTGRES_PASSWORD=ajaia_dev_pw `
  -e POSTGRES_DB=ajaia `
  -p 15432:5432 `
  -v ajaia-pgdata:/var/lib/postgresql/data `
  --restart unless-stopped `
  postgres:16-alpine
```

Create the isolated test database once:

```powershell
docker exec ajaia-pg createdb -U ajaia ajaia_test
```

If the container already exists, start it with `docker start ajaia-pg` instead of running
the `docker run` command again. If you use another PostgreSQL instance or port, update the
connection strings below and in `.env.local` accordingly.

### 3. Configure environment

Copy the sample file and keep the resulting `.env.local` private:

```powershell
Copy-Item .env.example .env.local
```

For the Docker setup above, `.env.local` should include:

```dotenv
DATABASE_URL=postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia
TEST_DATABASE_URL=postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia_test
DEMO_MODE=true
```

The test database is isolated and is cleared by the test suites. Never point
`TEST_DATABASE_URL` at a production or otherwise valuable database. `.env.local` is
git-ignored; do not commit its values.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | App PostgreSQL connection | Required |
| `TEST_DATABASE_URL` | Isolated test database connection | Required for tests |
| `DEMO_MODE` | Enables the demo account switcher | `false` |
| `MAX_UPLOAD_BYTES` | Maximum import file size | `1048576` (1 MB) |
| `SESSION_TTL_DAYS` | Session lifetime | `7` |
| `NODE_ENV` | Runtime mode set by Next.js | Set by runtime |

### 4. Apply schema and seed demo users

```powershell
npm run db:migrate
npm run db:seed
```

### 5. Run the app

```powershell
npm run dev
```

The development script uses Next.js Webpack mode for compatibility with Windows setups
that deny Turbopack's junction creation. Open the exact URL printed in the terminal.
If port `3000` is already occupied, Next.js selects another port (commonly `3001`). Use
that printed port, rather than opening a stale server on `3000`.

The project allows the local browser host `192.168.56.1` for development resources. If
you access the dev server through a different LAN host, add that host to
`allowedDevOrigins` in `next.config.ts` and restart the dev server.

## Demo accounts

With `DEMO_MODE=true`, the start screen offers these seeded accounts. There are no
passwords; this switcher is for local review only and is **not production authentication**.

| Email | Display name | Seeded role |
|---|---|---|
| `alex@demo.local` | Alex Demo | Owner of documents Alex creates |
| `sam@demo.local` | Sam Demo | Collaborator; receives access when a document is shared |

You can share only with users already present in the workspace. The demo seed creates the
two accounts above.

## API overview

All routes use JSON except file import, which uses `multipart/form-data`.

| Method | Route | Access |
|---|---|---|
| `GET` | `/api/health` | Public; reports database availability |
| `POST` | `/api/auth/demo-login` | Demo mode only; sets an httpOnly session cookie |
| `POST` | `/api/auth/logout` | Current session |
| `GET` | `/api/me` | Current session |
| `GET` | `/api/documents` | Current session; owned and shared list |
| `POST` | `/api/documents` | Current session; creates an owned document |
| `GET` | `/api/documents/:id` | Owner or member |
| `PATCH` | `/api/documents/:id` | Owner or editor |
| `DELETE` | `/api/documents/:id` | Owner only |
| `GET` | `/api/documents/:id/members` | Document member |
| `POST` | `/api/documents/:id/members` | Owner only; share by known email |
| `PATCH` | `/api/documents/:id/members/:userId` | Owner only; change role |
| `DELETE` | `/api/documents/:id/members/:userId` | Owner only; remove member |
| `POST` | `/api/documents/import` | Current session; imports `.txt` or Markdown |

The owner can edit, rename, delete, and manage sharing. Editors can edit and rename.
Viewers can read only. Non-members receive `404` for document reads and mutations to
avoid disclosing whether a document exists. Full request/response shapes, error codes,
limits, and permissions are in [docs/AGENT_CONTRACT.md](docs/AGENT_CONTRACT.md).

## Checks

Run these from the project directory:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` migrates and uses `TEST_DATABASE_URL`; it requires the test database to be
reachable and will clear its test data. Do not point it at production data.

The end-to-end API smoke check expects a production server and seeded database. In one
terminal:

```powershell
npm run build
npm start
```

In another terminal:

```powershell
npm run smoke
```

The smoke script defaults to `http://localhost:3000`. If the server prints another port,
set `SMOKE_BASE_URL` first, for example in PowerShell:

```powershell
$env:SMOKE_BASE_URL = 'http://localhost:3001'
npm run smoke
```

## Troubleshooting

**The page stays on “Opening your workspace…”**

Stop the old dev server with Ctrl+C and rerun `npm run dev`. Use the new URL printed by
Next.js. The dev script uses Webpack to avoid the Windows Turbopack junction error. Check
`http://localhost:<port>/api/health`; it should return HTTP 200 and `database: "up"`.
If the database is down, check PostgreSQL and the `DATABASE_URL` in `.env.local`.

**Port 3000 is already in use**

Use the alternate URL printed by Next.js, or stop the older process that owns port 3000.
Do not keep opening the old port if the current dev server chose a new one.

**Demo login reports it is disabled**

Set `DEMO_MODE=true` in `.env.local`, restart the dev server, and make sure the demo seed
has been applied with `npm run db:seed`.

## Project files

```text
app/                 Next.js app, UI, and API route handlers
lib/db/              Drizzle schema, migrations, client, and seed helpers
lib/server/          Auth, authorization, document services, import, and HTTP helpers
drizzle/             PostgreSQL migrations
scripts/             Migration, seed, and API smoke scripts
tests/               Persistence, authorization, import, and Markdown tests
docs/                API contract, architecture, security, workflow, and release notes
```

## Project documentation

- [API contract](docs/AGENT_CONTRACT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model and current verification](docs/SECURITY_MODEL.md)
- [AI workflow record](docs/AI_WORKFLOW.md)
- [Integration work log](docs/WORK_LOG.md)
- [Submission checklist](docs/SUBMISSION.md)
- [Walkthrough URL status](WALKTHROUGH_URL.txt)

No live deployment or walkthrough URL is claimed in this repository until one has been
created and verified.
