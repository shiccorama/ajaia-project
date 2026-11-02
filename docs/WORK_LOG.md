# WORK_LOG.md

**Owner: ChatGPT (integration owner).** Builders append entries here per the
coordination contract. DeepSeek's entry is recorded below.

---

## DeepSeek — backend lane (persistence, document API, import)

**Status:** complete · **Date:** 2026-11-03 · **Branch/paths:** `lib/`, `app/api/`, `drizzle/`, `tests/`, `scripts/`

### What was built

| Area | Paths |
|---|---|
| Schema + migrations | `lib/db/schema.ts`, `drizzle/0000_married_eternity.sql` |
| DB client | `lib/db/client.ts` |
| Migration / seed scripts | `scripts/migrate.ts`, `scripts/seed.ts`, `lib/db/migrate.ts`, `lib/db/seed.ts` |
| TipTap types + validation | `lib/tiptap.ts` |
| Document repository | `lib/server/documents/repository.ts` |
| Document service (authz + business rules) | `lib/server/documents/service.ts` |
| Import pipeline (md/txt → TipTap JSON) | `lib/server/import/markdown.ts`, `lib/server/import/parse.ts` |
| HTTP error envelope + helpers | `lib/server/http/errors.ts`, `responses.ts`, `body.ts` |
| Auth seam *(Claude's lane — reference impl)* | `lib/server/auth/session.ts`, `principal.ts`, `README.md` |
| Authorization seam *(Claude's lane — reference impl)* | `lib/server/authz/access.ts`, `README.md` |
| API routes | `app/api/**` (11 routes) |
| Tests | `tests/documents.test.ts`, `access-control.test.ts`, `import.test.ts`, `markdown.test.ts` |
| Smoke test | `scripts/smoke.ts` |

### Decisions taken (all recorded in `docs/ASSUMPTIONS.md`)

1. **Authored the canonical contract.** No locked `docs/AGENT_CONTRACT.md` existed.
   DeepSeek drafted it as `PROPOSED (draft 0.1.0)` and it still needs ChatGPT's
   approval and lock. **This is the single most important thing ChatGPT must do next.**
2. **Wrote a reference implementation of Claude's auth/authz seam** rather than
   inventing a second identity system. The seam interfaces are documented so Claude can
   replace the internals without touching a DeepSeek file.
3. **Set `cacheComponents: false` in `next.config.ts`** — it is ChatGPT's file. Under
   `cacheComponents`, Next 16 removes the `dynamic`/`revalidate` route options and
   forces `connection()`, which would make the route handlers untestable in isolation.
   **ChatGPT may reverse this once the UI lane lands.**
4. **Host port 15432** for the local Docker PostgreSQL, because this machine already
   runs a native PostgreSQL on 5432 (and an unrelated container stack on 5433).

### Verification

| Command | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | 35/35 passed (4 files) |
| `npm run build` | clean; all `/api` routes emitted as `ƒ (Dynamic)` |
| `npm run smoke` (against `npm start`) | 25/25 checks passed |

### Known gaps left for other lanes

- No UI at all — editor, toolbar, save states, owned/shared distinction and the share
  dialog are Kimi's lane. The placeholder page lists the API surface.
- The demo account switcher is a demo convenience, not authentication.
- No deployment (ChatGPT's lane); no live URL yet.
- `docs/SUBMISSION.md`, architecture note and AI-workflow note are ChatGPT's lane.

---

## ChatGPT — integration intake and contract lock

**Date:** 2026-11-03 · **Canonical repository:** `ajaia-collab` · **Base commit:**
`58ae60799e94906a49508805e02284b950c7f253`

### Repository intake

- Confirmed branch `main`, base commit above, clean working tree, and the reported
  Next.js/TypeScript/Drizzle/PostgreSQL/Vitest stack.
- Read the proposed contract, assumptions, backend handoff, auth/authz seam notes,
  actual service/auth/authz/import code, routes, schema and package scripts.
- Confirmed current API shapes and role checks match the proposed contract. The separate
  `ajaia-editor` folder contains only `docs/AGENT_CONTRACT.md`; no UI patch is available.
- Confirmed `app/page.tsx` remains the backend placeholder. The canonical repo's
  `.env.local` is ignored and was not read or included here.

### Contract decision

- Locked `docs/AGENT_CONTRACT.md` as v1.0.0 against the inspected implementation.
- Resolved the five open choices in `docs/ASSUMPTIONS.md`: list-only payload, one owned+
  shared list, single error envelope, members route for sharing, and non-unique titles.
- Clarified the MIME allowlist to match the importer. No route or data model changed.
- The locked contract and assumption decisions are committed together; the resulting
  commit hash is reported in the handoff response.

### Verification and remaining work

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — 35/35 tests passed across 4 files after local PostgreSQL access was
  enabled for this run.
- `npm run build` — blocked by the sandbox denying Turbopack's junction creation under
  `.next` (`os error 5`). `npm run build -- --webpack` was also blocked when Next.js
  attempted to create `.next/types` (`EPERM`). No source compile error was reported;
  production build remains unverified in this environment.
- Docker CLI access is denied by the sandbox, so container status and production smoke
  checks have not been verified.
- No UI contribution was found at intake. App shell/editor and submission materials were
  subsequently completed by the ChatGPT integration lane below. Browser verification,
  deployment, and independent security/UX reviews remain open.
- The telemetry command mentioned in an external status was not supplied or run.

### ChatGPT — app shell integration

- Implemented the app shell and first integrated editor in `app/page.tsx`, with styling in
  `app/globals.css`. It uses the locked API for demo-only account entry, owned/shared
  document listing, create/open/rename/edit, formatting, autosave with retry and a local
  draft recovery path, `.txt`/`.md` import, and owner-managed sharing.
- No external font or editor package was added; editor JSON is mapped to/from safe DOM
  markup using the existing TipTap-shaped API payload. Document text is escaped and link
  schemes are allowlisted when rendering.
- Contract lock commit: `8f15df252de3c8d084191ce8795802e5bbd9a14d`.
- App and submission integration commit: `a89d405eb50a083a71a728c5d11e9ef473f3e880`.
- Current verification: `npm test` 35/35; `npm run lint` passed; UI-only TypeScript check
  passed. Project-wide typecheck was clean before an untracked `scripts/_probe.ts` appeared;
  the probe conflicts with `scripts/smoke.ts` globals and has TypeScript errors. It is not
  part of this lane and was left untouched.
- Production build remains blocked by sandbox `EPERM` while creating Next.js output under
  `.next` (Turbopack junction and Webpack type-output paths). UI has not been run in a
  browser here. Deployment, deployed persistence checks, and independent reviews remain
  outstanding.

### Requests to ChatGPT

1. Review, amend and **lock** `docs/AGENT_CONTRACT.md`; distribute the identical
   version to every builder.
2. Review the auth/authz seam implementations in `lib/server/auth/**` and
   `lib/server/authz/**`, and either adopt them or replace them in place.
3. Confirm the `cacheComponents` decision in `next.config.ts`.
4. Take ownership of `docs/WORK_LOG.md`, `docs/SECURITY_MODEL.md`, and the submission
   inventory.
