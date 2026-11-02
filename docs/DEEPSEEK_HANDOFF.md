# DEEPSEEK_HANDOFF.md — backend lane handoff

**From:** DeepSeek (persistence · document API · import)
**To:** ChatGPT (integration owner) and Kimi (UI lane)
**Date:** 2026-11-03

---

## 1. Exact changed paths

Everything below is new. No pre-existing file was modified except `package.json`,
`next.config.ts`, `app/layout.tsx`, `app/page.tsx` and `.gitignore`.

```
app/api/health/route.ts
app/api/me/route.ts
app/api/auth/demo-login/route.ts
app/api/auth/logout/route.ts
app/api/documents/route.ts
app/api/documents/[id]/route.ts
app/api/documents/[id]/members/route.ts
app/api/documents/[id]/members/[userId]/route.ts
app/api/documents/import/route.ts
app/layout.tsx                              (modified — fonts removed, see §7)
app/page.tsx                                (modified — placeholder, see §7)

lib/tiptap.ts                               TipTap types, zod schema, limits
lib/env.ts                                  .env loader for CLI scripts
lib/db/schema.ts                            Drizzle schema (4 tables + 1 enum)
lib/db/client.ts                            pooled Drizzle client
lib/db/migrate.ts                           migration runner
lib/db/seed.ts                              demo seed + truncate helper

lib/server/http/errors.ts                   AppError + error codes
lib/server/http/responses.ts                JSON envelopes + route() wrapper
lib/server/http/body.ts                     JSON / multipart body parsing

lib/server/auth/session.ts                  *** CLAUDE'S SEAM *** reference impl
lib/server/auth/principal.ts                *** CLAUDE'S SEAM *** reference impl
lib/server/auth/README.md                   *** CLAUDE'S SEAM *** interface contract

lib/server/authz/access.ts                  *** CLAUDE'S SEAM *** reference impl
lib/server/authz/README.md                  *** CLAUDE'S SEAM *** interface contract

lib/server/documents/repository.ts          data access (no authorization)
lib/server/documents/service.ts             business rules + authorization calls
lib/server/import/markdown.ts               mdast → TipTap JSON
lib/server/import/parse.ts                  upload validation + txt → TipTap JSON

scripts/migrate.ts                          npm run db:migrate
scripts/seed.ts                             npm run db:seed
scripts/smoke.ts                            npm run smoke (end-to-end)

drizzle/0000_married_eternity.sql           generated migration
drizzle.config.ts                           drizzle-kit config

tests/documents.test.ts                     persistence + round-trip
tests/access-control.test.ts                roles + sharing rules
tests/import.test.ts                        upload validation + import
tests/markdown.test.ts                      conversion unit tests
tests/helpers.ts                            shared test helpers
tests/setup.ts                              per-worker env setup
tests/global-setup.ts                       test-DB migration runner
vitest.config.mts                           Vitest config

docs/AGENT_CONTRACT.md                      PROPOSED contract — needs ChatGPT's lock
docs/SECURITY_MODEL.md                      PROPOSED — Claude owns
docs/WORK_LOG.md                            ChatGPT owns
docs/ASSUMPTIONS.md                         decisions + open questions

.env.example                                placeholder env (committed)
.env.local                                  real local env (git-ignored)
.npmrc                                      npm 12 script allowlist
```

## 2. Schema and migration notes

Four tables, one enum. Migration file: `drizzle/0000_married_eternity.sql`.

- **`users`** — `id uuid pk`, `email text unique`, `display_name text`, `created_at`.
- **`sessions`** — `id uuid pk`, `user_id uuid fk → users (cascade)`,
  `token_hash text unique` (SHA-256 hex), `created_at`, `expires_at`.
- **`documents`** — `id uuid pk`, `title text`, `content jsonb` (TipTap JSON),
  `owner_id uuid fk → users`, `created_at`, `updated_at`.
  Index on `owner_id`.
- **`document_members`** — `id uuid pk`, `document_id uuid fk → documents (cascade)`,
  `user_id uuid fk → users (cascade)`, `role document_role`, `created_at`.
  Unique `(document_id, user_id)`. Indexes on `user_id` and `document_id`.
- **`document_role`** — Postgres enum `('editor','viewer')`.

**The owner is not a member row.** Ownership lives on `documents.owner_id`, which makes
"the owner cannot be removed or demoted" structurally true.

**Applying migrations:** `npm run db:migrate` (uses `DATABASE_URL`).
**Regenerating after a schema change:** `npm run db:generate` then `npm run db:migrate`.

## 3. Environment variable names (values omitted)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string for the app |
| `TEST_DATABASE_URL` | for tests | Isolated database, wiped between suites |
| `MAX_UPLOAD_BYTES` | no (1 048 576) | Upload size limit |
| `SESSION_TTL_DAYS` | no (7) | Session lifetime |
| `DEMO_MODE` | no (`false`) | Enables the demo account switcher |

There is **no** `SESSION_SECRET`: sessions use opaque random tokens hashed at rest,
not signed cookies. If Claude's implementation uses signed cookies, add the variable
to `docs/AGENT_CONTRACT.md` §7 and `.env.example`.

## 4. API summary

Base path `/api`. All responses are JSON. Errors always use
`{ "error": { "code", "message", "details"? } }`.

| Method | Route | Auth | Success |
|---|---|---|---|
| GET | `/api/health` | none | 200 `{status, database}` (503 if the DB is down) |
| POST | `/api/auth/demo-login` | `DEMO_MODE` | 200 `{user, demo}` + `Set-Cookie` |
| POST | `/api/auth/logout` | session | 200 `{ok:true}` + cookie cleared |
| GET | `/api/me` | session | 200 `{user}` |
| GET | `/api/documents` | session | 200 `{documents:[…]}` (owned + shared, **no** bodies) |
| POST | `/api/documents` | session | 201 document |
| GET | `/api/documents/:id` | member | 200 document (with body) |
| PATCH | `/api/documents/:id` | owner/editor | 200 document |
| DELETE | `/api/documents/:id` | owner | 204 |
| GET | `/api/documents/:id/members` | member | 200 `{owner, members}` |
| POST | `/api/documents/:id/members` | owner | 201 member |
| PATCH | `/api/documents/:id/members/:userId` | owner | 200 member |
| DELETE | `/api/documents/:id/members/:userId` | owner | 204 |
| POST | `/api/documents/import` | session | 201 document |

### Document shape

```jsonc
{
  "id": "uuid",
  "title": "Design notes",
  "content": { "type": "doc", "content": [ /* TipTap JSON */ ] },
  "ownerId": "uuid",
  "role": "owner",            // acting user's role: owner | editor | viewer
  "ownership": "owned",       // "owned" | "shared"  ← drives the owned/shared badge
  "createdAt": "2026-11-03T00:00:00.000Z",
  "updatedAt": "2026-11-03T00:00:00.000Z"
}
```

`GET /api/documents` returns the same shape **minus `content`**.

### Error codes

`BAD_REQUEST` · `SHARING_SELF_NOT_ALLOWED` · `UNAUTHENTICATED` · `FORBIDDEN` ·
`DOCUMENT_NOT_FOUND` · `USER_NOT_FOUND` · `MEMBER_NOT_FOUND` · `CONFLICT` ·
`FILE_TOO_LARGE` · `UNSUPPORTED_FILE_TYPE` · `VALIDATION_ERROR` · `INTERNAL_ERROR`

Status mapping: 400 / 401 / 403 / 404 / 409 / 413 / 415 / 422 / 500.

### Examples

```bash
# sign in as a demo user (demo mode only)
curl -c jar.txt -X POST http://localhost:3000/api/auth/demo-login \
  -H 'content-type: application/json' \
  -d '{"email":"alex@demo.local"}'

# create
curl -b jar.txt -X POST http://localhost:3000/api/documents \
  -H 'content-type: application/json' \
  -d '{"title":"Design notes"}'

# autosave
curl -b jar.txt -X PATCH http://localhost:3000/api/documents/<id> \
  -H 'content-type: application/json' \
  -d '{"title":"Design notes v2","content":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"hi"}]}]}}'

# share as viewer
curl -b jar.txt -X POST http://localhost:3000/api/documents/<id>/members \
  -H 'content-type: application/json' \
  -d '{"email":"sam@demo.local","role":"viewer"}'

# import
curl -b jar.txt -X POST http://localhost:3000/api/documents/import \
  -F 'file=@notes.md' -F 'title=Notes'
```

## 5. Integration note for ChatGPT and Kimi

### For Kimi (UI lane)

- **Owned vs shared.** Each document carries `ownership: "owned" | "shared"`. Use it for
  the visual distinction — the API will not merge them.
- **Save states.** `PATCH /api/documents/:id` returns the updated document, including a
  new `updatedAt`. Set your state to `saving` before the request, `saved` only after a
  2xx, and `failed` on any error — then offer a retry. Never show "Saved" optimistically.
- **Autosave payload.** Send `{ title?, content? }`. Send both when the title changed;
  send only `content` when only the body changed. Sending neither returns
  `422 VALIDATION_ERROR`.
- **A failed write never discards the draft.** The server rejects invalid content with
  `422` and a `details.field` pointing at the problem — keep the editor content and
  surface the message.
- **Viewer experience.** A viewer gets `403 FORBIDDEN` on writes. Read the `role` field
  from the document and disable editing for `viewer` in the UI — but treat the server
  as the authority.
- **Save state and content limits.** `content` must be a TipTap doc: `{type: "doc",
  content: [...]}`, nesting ≤ 20, serialized ≤ 1 MB. `title` ≤ 200 characters. Exceeding
  either returns `422 VALIDATION_ERROR`.
- **Import.** `POST /api/documents/import` is `multipart/form-data` with a `file` field
  (`.txt` / `.md`) and an optional `title`. The server converts the file to TipTap JSON
  and returns the created document. Show the server's message on `413` (too large) and
  `415` (wrong type) — they are already user-readable.
- **Share dialog.** `POST /api/documents/:id/members` with `{email, role}`. Possible
  failures worth special-casing: `400 SHARING_SELF_NOT_ALLOWED` (you already own it),
  `404 USER_NOT_FOUND` (no such account), `422 VALIDATION_ERROR` (bad role),
  `403 FORBIDDEN` (only the owner can share).
- **Session.** `POST /api/auth/demo-login` sets an httpOnly cookie. The browser never
  sees or sends a user id. Call `GET /api/me` to learn who you are.

### For ChatGPT (integration lane)

- **Contract needs locking.** `docs/AGENT_CONTRACT.md` is `PROPOSED`. Please approve or
  amend it, set `Status: LOCKED`, and distribute the identical file to every builder.
- **Claude's seam.** `lib/server/auth/**` and `lib/server/authz/**` contain reference
  implementations of Claude's lane. The README in each folder documents the exact
  interface Claude must preserve. If Claude replaces them, **no DeepSeek file changes**.
- **`next.config.ts`** — I set `cacheComponents: false` and rooted Turbopack and file
  tracing at the repo. The `cacheComponents` decision is yours to reverse.
- **Do not add a second app or a parallel schema.** Everything lives in this repo and
  this schema.
- **Deployment.** `DATABASE_URL` must point at a durable PostgreSQL (Supabase or
  equivalent) — not a container that disappears. `DEMO_MODE` must be explicitly set;
  it defaults to `false`.
- **Remaining submission work:** architecture note, AI-workflow note, `SUBMISSION.md`
  inventory, live URL, walkthrough URL, reviewer credentials, and screenshots.

## 6. Test commands and results

| Command | Result |
|---|---|
| `npm run typecheck` | clean, 0 errors |
| `npm test` | **35 passed / 35** (4 files) |
| `npm run build` | clean; `/api` routes all emitted as `ƒ (Dynamic)` |
| `npm run smoke` | **25 passed / 25** against `npm start` |

The suite runs against a **real PostgreSQL database** (`TEST_DATABASE_URL`), not a
mock, because the point is to prove data survives persistence and that authorization
is enforced server-side. `tests/global-setup.ts` migrates the test database
automatically, so `npm test` works from a clean checkout.

Coverage highlights:
- persistence after re-fetch (a second, independent request)
- TipTap JSON round-trip — heading level and marks survive
- unauthenticated read → 401
- non-member read → 404 with no content in the body
- viewer read → 200, viewer write → 403
- editor write → 200; editor reshare → 403
- owner share → 201; self-share → 400; unknown email → 404; bad role → 422
- owner cannot be removed; member role change; member removal revokes access
- upload: unsupported extension → 415; disallowed MIME → 415; > 1 MB → 413;
  binary content → 415; raw HTML dropped; `javascript:` links dropped

## 7. Known gaps and things I touched that you may want to change

- **No UI.** `app/page.tsx` is a placeholder listing the API surface, and
  `app/layout.tsx` is a minimal shell. I removed the scaffold's `next/font/google`
  import so `next build` does not depend on downloading fonts — restore it if you want.
- **`app/globals.css` and `app/page.module.css`** are untouched scaffold defaults.
  Kimi should replace them rather than adding a second stylesheet.
- **Authentication is a demo switcher**, not a login system.
- **No deployment, no live URL, no walkthrough** — ChatGPT's lane.
- **Markdown import does not support GFM tables**, and images are kept only for safe
  URL schemes.
- **`GET /api/documents` returns no document bodies** by design (see ASSUMPTIONS A11).
- **`docs/SECURITY_MODEL.md` is a proposal.** Claude owns it; GLM should red-team
  against the actual code.
