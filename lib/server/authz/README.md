# Authorization seam — **Claude owns this surface**

DeepSeek implemented a reference version of this seam because Claude's lane was not
available when the backend lane started. **Claude should replace the internals of
`access.ts`.** DeepSeek's routes depend only on the exported functions, never on the
implementation.

## File

| File | Exported API |
|---|---|
| `access.ts` | `DocumentAccess`, `AccessRequirement`, `getDocumentAccess(id, principal)`, `requireDocumentAccess(id, principal, requirement)` |

## Contract Claude must preserve

1. `requireDocumentAccess` throws `AppError` — it never returns `null`.
2. The error mapping is fixed by the shared contract:
   - document missing **or** caller is not a member → `404 DOCUMENT_NOT_FOUND`
   - caller is a member but the role forbids the action → `403 FORBIDDEN`
3. `requirement` semantics:
   - `'read'` — owner, editor, viewer may pass.
   - `'write'` — owner and editor may pass; a viewer gets `403`.
   - `'manage'` — only the owner may pass; editors and viewers get `403`.
4. The owner is **never** a row in `document_members`. Ownership lives on
   `documents.owner_id`, so the owner cannot be removed, demoted, or removed from the
   sharing API.
5. A caller who is not the owner and not a member must not learn whether the document
   exists.

## Role model

`owner | editor | viewer` — `owner` is derived from `documents.owner_id`; `editor` and
`viewer` come from `document_members.role` (a Postgres enum). There is no third way to
hold access, and no "admin" or "manager" role. DeepSeek did not create a competing
role scheme.

## Where it is called

Every DeepSeek route resolves access through this module:

| Route | Requirement |
|---|---|
| `GET /api/documents/:id` | `read` |
| `PATCH /api/documents/:id` | `write` |
| `DELETE /api/documents/:id` | `manage` (owner-only delete) |
| `GET /api/documents/:id/members` | `read` |
| `POST /api/documents/:id/members` | `manage` |
| `PATCH /api/documents/:id/members/:userId` | `manage` |
| `DELETE /api/documents/:id/members/:userId` | `manage` |

## Deliberately NOT implemented here

- Invitations, pending shares, share links, per-member expiry, and "transfer ownership".
  These are explicitly out of scope for the assignment (contract §1, "do not add …").
