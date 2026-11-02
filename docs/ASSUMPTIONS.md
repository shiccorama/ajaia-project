# ASSUMPTIONS.md — decisions and open questions

Every assumption this lane made that was **not** specified by the master integration
plan or the DeepSeek handoff brief. Each entry says what was assumed, why, and what
breaks if it is wrong.

| # | Area | Assumption | Why | If wrong |
|---|---|---|---|---|
| A1 | Contract | DeepSeek drafted the contract; ChatGPT reviewed implementation and locked it as v1.0.0 on 2026-11-03 | The implementation needed one canonical API before UI integration | Any change to the shared contract now requires a versioned amendment |
| A2 | Auth | Claude's auth lane was unavailable, so a **reference** implementation of the identity + authorization seam was written | The API cannot be authorized without an identity source; inventing a second one would violate the "no competing auth system" rule | Claude replaces the internals of `lib/server/auth/**` and `lib/server/authz/**`; no DeepSeek file needs to change |
| A3 | Roles | `viewer` may read only; `editor` may read, edit and rename; only `owner` may share, delete and manage members | The brief states viewers cannot edit/rename/reshare; the rest follows from the owner/editor/viewer split | Adjust the `AccessRequirement` mapping in `lib/server/authz/access.ts` |
| A4 | Error codes | Non-members get `404`, role-forbidden members get `403` | The brief requires "handle missing/inaccessible IDs without leaking content" | Change the throw sites in `lib/server/authz/access.ts` |
| A5 | Owner representation | The owner lives on `documents.owner_id`, not as a `document_members` row | Makes "the owner cannot be removed" structurally true rather than a rule | Would require a schema change and a data migration |
| A6 | Editor content | Stored as TipTap JSON in a `jsonb` column | The brief says "prefer TipTap JSON" | Change `documents.content` and the validation layer |
| A7 | Import types | `.txt`, `.md`, `.markdown` accepted; `application/octet-stream` tolerated when the extension and content checks pass | Browsers frequently send a generic MIME for `.md` | Tighten `ALLOWED_MIME_TYPES` in `lib/server/import/parse.ts` |
| A8 | Upload limit | 1 MB, overridable with `MAX_UPLOAD_BYTES` | The brief specifies 1 MB as the default | Change the default in `lib/tiptap.ts` |
| A9 | Markdown scope | CommonMark only; no GFM tables. Raw HTML dropped; `javascript:`/`data:` URLs rejected; images allowed only for safe URL schemes | Tables are not in the required feature list; the security rules are more valuable than table fidelity | Extend `lib/server/import/markdown.ts` |
| A10 | Demo auth | A demo account switcher gated by `DEMO_MODE=true`, issuing a normal server-side session | The brief explicitly allows a demo-only account switcher | Remove `POST /api/auth/demo-login` and `DEMO_MODE` |
| A11 | List endpoint | `GET /api/documents` returns list items **without** the document body | A document list should not ship every document's content | Include `content` in `listDocuments` in `lib/server/documents/service.ts` |
| A12 | Stack | TypeScript + Next.js 16 App Router + Drizzle ORM + PostgreSQL 16 | The master plan's default greenfield direction | Changing the stack is a project-wide decision for ChatGPT |
| A13 | Local database | Docker `postgres:16-alpine` on host port **15432** with a named volume | This machine already runs a native PostgreSQL on 5432 and an unrelated container on 5433 | Change the port in `.env.local`, `.env.example` and `drizzle.config.ts` |
| A14 | Next caching | `cacheComponents: false`, routes use `export const dynamic = 'force-dynamic'` | With `cacheComponents` on, Next 16 bans `dynamic`/`revalidate` and forces `connection()`, which breaks isolated route-handler testing | ChatGPT re-enables it and adapts the routes once the UI lands |
| A15 | No CSRF tokens | `SameSite=Lax` cookies only | Out of scope for the assignment; noted in `docs/SECURITY_MODEL.md` §8 | Add an `Origin` check or CSRF token in the auth lane |

## Resolved at contract lock (v1.0.0)

1. `GET /api/documents` stays list-only; it returns a single array with an `ownership`
   field (A11).
2. The list endpoint is not split by scope; clients filter by `ownership`.
3. Errors keep the single `{ error: { code, message, details? } }` envelope.
4. Sharing uses `POST /api/documents/:id/members`; there is no convenience `/share` route.
5. Titles are free-form and are not unique per owner.
