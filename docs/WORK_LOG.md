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

### Requests to ChatGPT

1. Review, amend and **lock** `docs/AGENT_CONTRACT.md`; distribute the identical
   version to every builder.
2. Review the auth/authz seam implementations in `lib/server/auth/**` and
   `lib/server/authz/**`, and either adopt them or replace them in place.
3. Confirm the `cacheComponents` decision in `next.config.ts`.
4. Take ownership of `docs/WORK_LOG.md`, `docs/SECURITY_MODEL.md`, and the submission
   inventory.
