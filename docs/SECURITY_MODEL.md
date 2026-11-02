# SECURITY_MODEL.md — proposed draft

**Status:** `PROPOSED (draft 0.1.0)` — **security review pending.**
**Drafted by:** DeepSeek lane, 2026-11-03, to unblock implementation.

> The architecture/security lane was not available when the backend lane started. This
> file records the security properties the backend actually implements as a starting
> point for Gemini's architecture review and GLM's independent red-team review. Neither
> review is represented as complete here.

---

## 1. Trust boundaries

```
Browser  ──httpOnly cookie──▶  Next.js route handler  ──SQL──▶  PostgreSQL
                                        │
                                        └──▶  filesystem (uploads are read into
                                             memory, never written to disk)
```

- The **browser is untrusted**. It never supplies an identity that the server accepts
  at face value.
- The **database is the trust anchor**. All authorization decisions are made from
  server-side state (`documents.owner_id`, `document_members.role`, `sessions`).
- **Uploaded files are untrusted input** and are validated and converted on the server.

## 2. Authentication

| Property | Implementation |
|---|---|
| Credential | Opaque random session token, 32 bytes CSPRNG, base64url |
| Transport | httpOnly cookie `ajaia_session`, `SameSite=Lax`, `Secure` in production |
| At rest | Only the **SHA-256 hash** of the token is stored in `sessions.token_hash` |
| Expiry | `sessions.expires_at`, enforced in SQL (`expires_at > now()`) |
| Resolution | `resolvePrincipal(req)` reads the cookie only |

**Invariant:** a user id in a request header, body, or query parameter is never
treated as proof of identity. There is no client-controlled `userId` path into the
data layer — the only `userId` that reaches the queries comes from the resolved
session row.

**Demo account switcher:** `POST /api/auth/demo-login` is gated by
`DEMO_MODE=true`, is clearly labelled demo-only, and issues a normal server-side
session. It is **not** production authentication and must not be presented as such.

## 3. Authorization

Roles are `owner | editor | viewer`. The owner is derived from
`documents.owner_id` and is **not** a row in `document_members`, so the owner can
never be deleted, demoted, or removed through the sharing API.

| Action | owner | editor | viewer | non-member |
|---|---|---|---|---|
| Read | ✅ | ✅ | ✅ | ❌ 404 |
| Write content / rename | ✅ | ✅ | ❌ 403 | ❌ 404 |
| Delete document | ✅ | ❌ 403 | ❌ 403 | ❌ 404 |
| Manage members | ✅ | ❌ 403 | ❌ 403 | ❌ 404 |

Enforcement point: `lib/server/authz/access.ts` (`requireDocumentAccess`). Every route
resolves access through that one helper; the repository layer performs **no**
authorization of its own, which keeps the rules in a single auditable place.

**Information disclosure control.** A non-member receives `404 DOCUMENT_NOT_FOUND`,
identical to the response for a document that does not exist. Document existence is
therefore not leaked to users who were never granted access. A member who attempts
an action their role forbids receives `403 FORBIDDEN`, because access is already
established and the UI needs to explain the refusal.

**Sharing rules enforced server-side:**
- self-sharing → `400 SHARING_SELF_NOT_ALLOWED`
- unknown email → `404 USER_NOT_FOUND` (never silently accepted)
- invalid role → `422 VALIDATION_ERROR`
- only the owner may add, re-role, or remove members
- the owner cannot be removed

## 4. Input validation

| Input | Limits | Enforcement |
|---|---|---|
| Title | 1–200 chars, trimmed, non-empty | `normalizeTitle` → `422` |
| Editor content | TipTap JSON schema, depth ≤ 20, serialized ≤ 1 MB | `validateTipTapDoc` → `422` |
| Upload | extension allowlist, MIME allowlist, ≤ 1 MB, UTF-8, not binary | `validateUpload` → `413` / `415` |
| Request body | must be a JSON object | `readJsonBody` → `400` |

## 5. Upload handling

Checks run in a fixed order: **size → extension → MIME → decodability → binary sniff**.

- Allowed extensions: `.txt`, `.md`, `.markdown`.
- Allowed MIME types: `text/plain`, `text/markdown`, `text/x-markdown`, `text/x-md`,
  `text/md`, `application/markdown`, and generic `application/octet-stream`
  (browsers commonly send it for `.md`; the extension and content checks still apply).
- A NUL byte in the decoded content → rejected as binary.
- A U+FFFD replacement character → rejected as "not valid UTF-8".

**Uploaded content is never stored or rendered as HTML.** Markdown is parsed with
`mdast-util-from-markdown` and converted to a TipTap JSON tree:

- raw HTML nodes in the Markdown are **dropped**;
- link and image URLs are checked against a protocol allowlist
  (`http`, `https`, `mailto`, `tel`, relative) — `javascript:`, `data:` and
  `vbscript:` are rejected, and a rejected link degrades to plain text;
- links get `rel="noopener noreferrer nofollow"` and `target="_blank"`.

Plain text is converted to paragraphs with hard breaks; it is stored as text nodes,
so no markup is ever interpreted.

## 6. Error handling and disclosure

- Every failure crossing the HTTP boundary is an `AppError` with a stable code from
  `docs/AGENT_CONTRACT.md` §4.2. Unexpected failures become a generic
  `500 INTERNAL_ERROR`; the underlying error is logged server-side, never returned.
- Error bodies never contain document content, SQL, file paths, or stack traces.
- `console.error` is used for server-side diagnosis only.

## 7. Secrets

- No secret is committed. `.env.local` is git-ignored; `.env.example` carries
  placeholder values only.
- The demo database credentials in `.env.example` are local-development values for a
  throwaway Docker container, not production credentials.
- Production should use a managed PostgreSQL (Supabase) with its own credentials and
  a restricted application role.

## 8. Known gaps and residual risk

These are **not** fixed by this lane and are listed so the security reviewer can
prioritise them.

| Gap | Impact | Note |
|---|---|---|
| No CSRF token | `SameSite=Lax` blocks cross-site POSTs from forms in modern browsers, but this is defence-in-depth, not a complete CSRF defence | Add a CSRF token or an `Origin` check when real auth lands |
| No rate limiting | Login and import endpoints can be hammered | Add per-IP/session limits at the edge |
| No real authentication | The demo switcher is not a login system | Out of scope for the assignment; must be labelled demo-only |
| No TLS in local dev | Session cookie travels in plaintext locally | Use HTTPS in any deployed environment |
| Sessions are not revocable individually | No "sign out other devices" | Add a `revoked_at` column when auth is real |
| TipTap renders node types the server does not whitelist | A malicious client could store an exotic node type | The TipTap editor only renders registered extensions; the server validates *shape*, not the node vocabulary |
| No audit log of share changes | Cannot reconstruct who shared what | `document_members.created_at` gives a partial trail |

## 9. Verification status (2026-11-03)

- `npm test`: **35/35 passed** against the configured PostgreSQL test database during
  the current integration pass, covering persistence, formatting round-trip,
  authorization, sharing rules, and upload rejection paths.
- `npm run lint`: passed during the current integration pass.
- `npm run typecheck`: passed before an untracked `scripts/_probe.ts` appeared. The
  current full typecheck fails because that file conflicts with `scripts/smoke.ts` globals
  and has separate type errors; the probe was not modified.
- Production build: not verified. Next build output was blocked by sandbox file-system
  errors under `.next`.
- `npm run smoke`: not run during this pass; Docker access was denied by the sandbox.
