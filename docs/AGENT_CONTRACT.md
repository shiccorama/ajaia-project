# AGENT_CONTRACT.md — canonical shared contract

**Status:** `LOCKED (1.0.0)`
**Drafted by:** DeepSeek lane (backend); reviewed and locked by ChatGPT integration owner
**Date:** 2026-11-03

> Lock decision: this contract was reconciled against the canonical repository at
> `58ae60799e94906a49508805e02284b950c7f253`. The route shapes and authorization behavior
> below match the implementation. The open choices from `docs/ASSUMPTIONS.md` are resolved
> in §10. Changes to shared interfaces require a new contract version and a recorded review.

**Repository:** `ajaia-collab` (single repo, single app)
**Stack:** TypeScript · Next.js 16 (App Router) · Drizzle ORM · PostgreSQL 16 · Zod · Vitest

---

## 1. Non-negotiable invariants

These are copied from the master plan and apply to every lane.

1. **Server-side identity only.** The server resolves the acting user from an httpOnly
   session cookie. A user ID supplied by the client (header, body, query param) is
   **never** treated as proof of identity.
2. **Every read and every mutation is authorized server-side.** Owner, `editor`, and
   `viewer` roles are checked in the data layer, not in the UI.
3. **Never display "Saved" before the server confirms persistence.** Save state is
   `saving | saved | failed`, and `failed` must offer a retry path.
4. **Owned and shared documents are visually distinct.**
5. **Uploads are validated on the server**: extension allowlist, size limit, encoding
   check. Uploaded content is never rendered as trusted HTML.
6. **Durable store only.** The production source of truth is PostgreSQL. The local
   filesystem is never a production store.
7. **One app, one schema, one router, one stylesheet.** No second app, parallel schema,
   competing router, or duplicate global stylesheet.
8. **Formatting survives a round-trip.** Editor content is stored as structured TipTap
   JSON, not HTML or plain text.

---

## 2. Data model

PostgreSQL. Migration files live in `drizzle/`. All timestamps are `timestamptz`.

### `users`
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `email` | `text` UNIQUE NOT NULL | lowercased on write |
| `display_name` | `text` NOT NULL | |
| `created_at` | `timestamptz` NOT NULL | default `now()` |

### `sessions`
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL → `users.id` | `ON DELETE CASCADE` |
| `token_hash` | `text` UNIQUE NOT NULL | SHA-256 hex of the cookie token; the raw token exists only in the cookie |
| `created_at` | `timestamptz` NOT NULL | |
| `expires_at` | `timestamptz` NOT NULL | |

### `documents`
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | stable ID |
| `title` | `text` NOT NULL | max 200 chars |
| `content` | `jsonb` NOT NULL | TipTap JSON document |
| `owner_id` | `uuid` NOT NULL → `users.id` | |
| `created_at` | `timestamptz` NOT NULL | |
| `updated_at` | `timestamptz` NOT NULL | bumped on every successful write |

Indexes: `documents(owner_id)`.

### `document_members`
| column | type | notes |
|---|---|---|
| `id` | `uuid` PK | |
| `document_id` | `uuid` NOT NULL → `documents.id` | `ON DELETE CASCADE` |
| `user_id` | `uuid` NOT NULL → `users.id` | `ON DELETE CASCADE` |
| `role` | `document_role` NOT NULL | enum `('editor','viewer')` |
| `created_at` | `timestamptz` NOT NULL | |

Unique: `(document_id, user_id)`. Indexes: `document_members(user_id)`, `document_members(document_id)`.

> The owner is **not** a row in `document_members`. Ownership lives on `documents.owner_id`,
> so the owner can never be deleted, demoted, or removed by the sharing API.

### `document_role` enum
`'editor' | 'viewer'` — owner is represented by `documents.owner_id`, never as a role value.

---

## 3. Authorization matrix

Let `R` = role resolved server-side for the acting user on a document.

| Action | owner | editor | viewer | non-member |
|---|---|---|---|---|
| Read document + content | ✅ | ✅ | ✅ | ❌ 404 |
| List owned / shared documents | ✅ (owned) | ✅ (shared) | ✅ (shared) | ✅ (empty) |
| Create document | ✅ | ✅ | ✅ | ✅ |
| Update content (autosave) | ✅ | ✅ | ❌ 403 | ❌ 404 |
| Rename (title) | ✅ | ✅ | ❌ 403 | ❌ 404 |
| Delete document | ✅ | ❌ 403 | ❌ 403 | ❌ 404 |
| Import `.txt` / `.md` (creates own doc) | ✅ | ✅ | ✅ | ✅ |
| List members | ✅ | ✅ | ✅ | ❌ 404 |
| Add / change / remove a member | ✅ | ❌ 403 | ❌ 403 | ❌ 404 |

**Non-members get `404`, not `403`**, so document existence is not leaked to users who
were never granted access. Members attempting an action their role forbids get `403`,
because access is already established and the UI can explain the refusal.

Additional sharing rules (enforced server-side):
- Self-sharing is rejected (`400 SHARING_SELF_NOT_ALLOWED`).
- Sharing with an unknown email is rejected (`404 USER_NOT_FOUND`) — never silently accepted.
- The owner cannot be removed or demoted.
- Only the owner may change or remove memberships.
- A member's role may be changed by the owner; re-sharing with the same user updates the role.

---

## 4. HTTP API

Base path `/api`. All responses are `application/json`.

### 4.1 Success envelope

Single-resource responses return the resource at the top level:

```jsonc
// GET /api/documents/:id
{
  "id": "uuid",
  "title": "Design notes",
  "content": { "type": "doc", "content": [ ... ] },  // TipTap JSON
  "ownerId": "uuid",
  "role": "owner",          // acting user's role on this document
  "ownership": "owned",     // "owned" | "shared"
  "createdAt": "2026-11-03T00:00:00.000Z",
  "updatedAt": "2026-11-03T00:00:00.000Z"
}
```

### 4.2 Error envelope

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable, actionable message.",
    "details": { "field": "reason" }   // optional
  }
}
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | malformed request |
| 400 | `SHARING_SELF_NOT_ALLOWED` | owner tried to share with themselves |
| 401 | `UNAUTHENTICATED` | missing or expired session |
| 403 | `FORBIDDEN` | authenticated but the role forbids this action |
| 404 | `DOCUMENT_NOT_FOUND` | document missing **or** not accessible to the caller |
| 404 | `USER_NOT_FOUND` | share target email is not a known user |
| 404 | `MEMBER_NOT_FOUND` | target is not a member of this document |
| 409 | `CONFLICT` | conflicting state (e.g. duplicate membership) |
| 413 | `FILE_TOO_LARGE` | upload exceeds the configured limit |
| 415 | `UNSUPPORTED_FILE_TYPE` | extension/type not allowed, or not decodable text |
| 422 | `VALIDATION_ERROR` | request body failed validation |
| 500 | `INTERNAL_ERROR` | unexpected failure — never masks a write as success |

Error responses never include document content.

### 4.3 Route table

| Method | Route | Who | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | anyone | liveness + DB reachability |
| `POST` | `/api/auth/demo-login` | demo mode only | dev-only session switcher |
| `POST` | `/api/auth/logout` | any session | destroy current session |
| `GET` | `/api/me` | any session | current user profile |
| `GET` | `/api/documents` | any session | `{ documents: [...] }` — owned **and** shared |
| `POST` | `/api/documents` | any session | create `{ title, content? }` → 201 |
| `GET` | `/api/documents/:id` | member | read document incl. content |
| `PATCH` | `/api/documents/:id` | owner/editor | update `{ title?, content? }` (autosave target) |
| `DELETE` | `/api/documents/:id` | owner | delete document → 204 |
| `GET` | `/api/documents/:id/members` | member | list members + roles |
| `POST` | `/api/documents/:id/members` | owner | share `{ email, role }` → 201 |
| `PATCH` | `/api/documents/:id/members/:userId` | owner | change role `{ role }` |
| `DELETE` | `/api/documents/:id/members/:userId` | owner | remove member → 204 |
| `POST` | `/api/documents/import` | any session | multipart upload → 201 |

### 4.4 Request shapes

```ts
// POST /api/documents
{ title: string, content?: TipTapDoc }

// PATCH /api/documents/:id   (autosave sends both fields)
{ title?: string, content?: TipTapDoc }

// POST /api/documents/:id/members
{ email: string, role: "editor" | "viewer" }

// PATCH /api/documents/:id/members/:userId
{ role: "editor" | "viewer" }

// POST /api/documents/import  (multipart/form-data)
file: <File>            // .txt or .md
title?: string          // defaults to the file name without extension
```

`TipTapDoc` is a TipTap JSON document: `{ type: "doc", content: TipTapNode[] }`.
`TipTapNode` = `{ type, attrs?, content?, text?, marks? }` — see `lib/tiptap.ts` for the
zod schema the server validates against.

---

## 5. Import rules

- **Allowed extensions:** `.txt`, `.md`, `.markdown`.
- **Allowed MIME types:** `text/plain`, `text/markdown`, `text/x-markdown`,
  `text/x-md`, `text/md`, `application/markdown`, and generic `application/octet-stream`.
  Parameters are ignored; a missing MIME type is accepted. The extension and content
  checks must still pass.
- **Size limit:** 1 MB by default, overridable with `MAX_UPLOAD_BYTES`.
- **Server-side checks, in order:** size → extension → MIME → UTF-8 decodability →
  no NUL bytes (binary rejection).
- **Markdown → TipTap JSON.** Headings, paragraphs, bold, italic, inline code, code
  blocks, bullet/numbered lists, blockquotes, horizontal rules, and links are converted.
  Raw HTML in Markdown is **dropped**, never rendered.
- **Plain text → TipTap JSON.** Blank-line-separated blocks become paragraphs; single
  newlines inside a block become hard breaks.
- The imported document is owned by the importing user and is immediately editable.

---

## 6. Limits (single source of truth)

| Limit | Value | Env override |
|---|---|---|
| Upload size | 1 MB (1 048 576 bytes) | `MAX_UPLOAD_BYTES` |
| Document title | 200 characters | — |
| TipTap JSON serialized size | 1 MB | — |
| TipTap node nesting depth | 20 | — |
| Session lifetime | 7 days | `SESSION_TTL_DAYS` |

---

## 7. Environment variables

Names only — **never commit values**.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | — (required) |
| `TEST_DATABASE_URL` | isolated test database | — (required for tests) |
| `MAX_UPLOAD_BYTES` | upload limit in bytes | `1048576` |
| `SESSION_TTL_DAYS` | session lifetime in days | `7` |
| `DEMO_MODE` | enables the demo account switcher | `false` |
| `NODE_ENV` | runtime mode | — |

> **There is deliberately no `SESSION_SECRET`.** Sessions use opaque random tokens
> whose SHA-256 hash is stored, not signed cookies. If Claude's implementation switches
> to signed cookies, add the variable here and to `.env.example`.
>
> **Local port:** this project's Docker PostgreSQL is published on host port **15432**
> because the development machine already runs a native PostgreSQL on 5432. Change the
> port in `.env.local`, `.env.example` and `drizzle.config.ts` to match your setup.

---

## 8. Route / file ownership map

| Path | Owner | Notes |
|---|---|---|
| `lib/db/**` | **DeepSeek** | schema, client, migrations, seed |
| `lib/server/documents/**` | **DeepSeek** | repository + service layer |
| `lib/server/import/**` | **DeepSeek** | markdown/txt → TipTap JSON, upload validation |
| `lib/server/http/**` | **DeepSeek** | error envelope + response helpers |
| `lib/tiptap.ts` | **DeepSeek** | TipTap types + zod schema |
| `lib/server/auth/**` | **Security lane (Gemini)** ⚠️ | identity resolution — current code is a reference implementation pending security review |
| `lib/server/authz/**` | **Security lane (Gemini)** ⚠️ | access-control helper — current code is a reference implementation pending security review |
| `app/api/**` | **DeepSeek** (backend routes) | thin HTTP handlers over the service layer |
| `app/**` UI components | **Kimi** | editor, toolbar, save states, share dialog |
| `app/layout.tsx`, `app/page.tsx`, shell | **ChatGPT** | app shell, routing, integration |

⚠️ **Seam notice.** The security lane was not available when the backend was built.
Rather than invent a parallel auth system, DeepSeek implemented a small reference seam.
Any replacement must preserve its documented interface or amend this contract and the
routes in the same reviewed change. The seam contracts are in `lib/server/auth/README.md`
and `lib/server/authz/README.md`.

---

## 9. Change protocol

1. Any change to a route shape, field name, role name, or error code goes through
   **ChatGPT** and updates this file first.
2. Builders record what they changed in `docs/WORK_LOG.md`.
3. Cross-lane changes are proposed, never silently applied.
4. Keep an assumptions/decision log — see `docs/ASSUMPTIONS.md`.

---

## 10. Lock decisions (1.0.0)

These choices resolve the open questions in `docs/ASSUMPTIONS.md` and match the current
service and route implementation:

1. `GET /api/documents` returns one `{ documents: [...] }` array containing owned and
   shared list items with an `ownership` field; list items omit `content`.
2. All errors use the single `{ error: { code, message, details? } }` envelope.
3. Sharing uses `POST /api/documents/:id/members`; no convenience `/share` route is added.
4. Titles are free-form per owner (no uniqueness constraint), trimmed, non-empty, and
   limited to 200 characters.
5. Role permissions, import rules, limits, and all other route shapes above are the
   integration contract for version 1.0.0.

**Lock boundary:** this locks the API, data, and authorization contract for integration.
The auth/authz helpers are currently the reference implementation pending the assigned
security review. Any proposed behavior change must be submitted as a contract amendment.
