# ajaia-collab

A lightweight collaborative document editor — **backend lane**.

> **Scope note.** This repository currently contains the **backend only**: the data
> model, the document API, server-side authorization, and the `.txt` / `.md` import
> pipeline. The editor interface belongs to the UI lane and is **not** part of this
> build, so `app/page.tsx` is a placeholder that lists the available endpoints.
>
> See `docs/DEEPSEEK_HANDOFF.md` for the full handoff and `docs/AGENT_CONTRACT.md`
> for the API contract.

---

## Stack

| | |
|---|---|
| Language | TypeScript 5 (strict) |
| Framework | Next.js 16 (App Router) · React 19 |
| Database | PostgreSQL 16 · Drizzle ORM |
| Validation | Zod 4 |
| Editor content | TipTap JSON (stored as `jsonb`) |
| Markdown parsing | `mdast-util-from-markdown` (CommonMark) |
| Tests | Vitest 5 against a **real** PostgreSQL database |

---

## Prerequisites

- Node.js 20.11+ (developed on Node 24)
- Docker Desktop (for the local PostgreSQL) — or any reachable PostgreSQL 14+
- npm 10+ (this project uses npm; npm 12's script allowlist is configured in `.npmrc`)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL

The project expects PostgreSQL on **host port 15432** — this machine already runs a
native PostgreSQL on 5432, so the container is published on a free port. The named
volume `ajaia-pgdata` keeps the data across restarts.

```bash
docker run -d --name ajaia-pg \
  -e POSTGRES_USER=ajaia \
  -e POSTGRES_PASSWORD=ajaia_dev_pw \
  -e POSTGRES_DATABASE=ajaia \
  -p 15432:5432 \
  -v ajaia-pgdata:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:16-alpine
```

Create the isolated test database:

```bash
docker exec ajaia-pg createdb -U ajaia ajaia_test
```

### 3. Configure the environment

```bash
cp .env.example .env.local
```

`.env.local` is git-ignored. Set at minimum:

```
DATABASE_URL=postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia
TEST_DATABASE_URL=postgres://ajaia:ajaia_dev_pw@localhost:15432/ajaia_test
DEMO_MODE=true
```

### 4. Migrate and seed

```bash
npm run db:migrate     # apply drizzle/ migrations
npm run db:seed        # create the two demo accounts
```

### 5. Run

```bash
npm run dev            # development, http://localhost:3000
# or
npm run build && npm start
```

---

## Demo accounts

Seeded by `npm run db:seed`. **Demo-only** — there is no password, and the account
switcher is disabled unless `DEMO_MODE=true`.

| Email | Name | ID |
|---|---|---|
| `alex@demo.local` | Alex Demo | `00000000-0000-4000-8000-000000000001` |
| `sam@demo.local` | Sam Demo | `00000000-0000-4000-8000-000000000002` |

Switch account with `POST /api/auth/demo-login` — it sets an httpOnly session cookie:

```bash
curl -c jar.txt -X POST http://localhost:3000/api/auth/demo-login \
  -H 'content-type: application/json' \
  -d '{"email":"alex@demo.local"}'
```

---

## API

| Method | Route | Who |
|---|---|---|
| GET | `/api/health` | anyone |
| POST | `/api/auth/demo-login` | demo mode only |
| POST | `/api/auth/logout` | session |
| GET | `/api/me` | session |
| GET | `/api/documents` | session — owned **and** shared |
| POST | `/api/documents` | session |
| GET | `/api/documents/:id` | owner / editor / viewer |
| PATCH | `/api/documents/:id` | owner / editor (autosave target) |
| DELETE | `/api/documents/:id` | owner |
| GET | `/api/documents/:id/members` | member |
| POST | `/api/documents/:id/members` | owner |
| PATCH | `/api/documents/:id/members/:userId` | owner |
| DELETE | `/api/documents/:id/members/:userId` | owner |
| POST | `/api/documents/import` | session — `.txt` / `.md` |

Roles are `owner`, `editor`, `viewer`. A viewer can read but not edit, rename or
reshare. A non-member receives `404` so document existence is not leaked.

Full request/response shapes, error codes and limits: **`docs/AGENT_CONTRACT.md`**.

---

## Verification

```bash
npm run typecheck   # tsc --noEmit
npm test            # 35 tests against a real PostgreSQL database
npm run build       # production build
npm run smoke       # 25 end-to-end checks against a running server
```

`npm test` migrates the test database automatically, so it works from a clean
checkout. `npm run smoke` needs a running server (`npm start`) in another terminal.

To run everything in sequence:

```bash
npm run verify
```

---

## Project layout

```
app/
  api/                    HTTP routes (thin handlers over the service layer)
  layout.tsx              app shell — ChatGPT's lane
  page.tsx                placeholder — ChatGPT/Kimi's lane
lib/
  tiptap.ts               TipTap types, Zod schema, limits
  db/                     schema, client, migrations, seed
  server/
    auth/                 identity resolution — CLAUDE'S SEAM
    authz/                access-control helper — CLAUDE'S SEAM
    documents/            repository + service layer
    import/               md/txt → TipTap JSON, upload validation
    http/                 error envelope, response helpers, body parsing
scripts/                  migrate, seed, smoke
tests/                    Vitest suites
drizzle/                  generated SQL migrations
docs/                     contract, security model, work log, assumptions, handoff
```

---

## Documentation

| File | Purpose |
|---|---|
| `docs/AGENT_CONTRACT.md` | **The canonical API contract** — currently `PROPOSED`, awaiting ChatGPT's lock |
| `docs/SECURITY_MODEL.md` | Security properties and residual risks — Claude's lane |
| `docs/DEEPSEEK_HANDOFF.md` | Backend lane handoff, integration notes for ChatGPT and Kimi |
| `docs/WORK_LOG.md` | Cross-lane work log — ChatGPT owns |
| `docs/ASSUMPTIONS.md` | Every assumption made, why, and what breaks if it is wrong |

---

## License

Private project work for the Ajaia full-stack assignment.
