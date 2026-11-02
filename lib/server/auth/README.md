# Auth seam — **Claude owns this surface**

DeepSeek implemented a reference version of this seam because Claude's lane was not
available when the backend lane started. **Claude should replace the internals of these
files.** DeepSeek owns no behaviour that depends on their internals.

## Files

| File | Exported API | Purpose |
|---|---|---|
| `principal.ts` | `Principal`, `resolvePrincipal(req)`, `requirePrincipal(req)`, `readCookie(header, name)` | resolve the acting user from the request |
| `session.ts` | `SESSION_COOKIE_NAME`, `createSession(userId)`, `deleteSessionByToken(token)`, `findUserBySessionToken(token)`, `hashSessionToken`, `isDemoMode()` | session lifecycle |

## Contract Claude must preserve

These are the guarantees every DeepSeek route depends on. If Claude changes them, the
routes must be updated in the same change.

1. `requirePrincipal(req)` **throws `AppError(401, 'UNAUTHENTICATED')`** when there is no
   valid session — it never returns `null` and never falls back to a client-supplied id.
2. `resolvePrincipal(req)` returns `Principal | null`. `Principal.userId` is always a
   real row in `users`.
3. Identity comes from the **httpOnly cookie `ajaia_session`** only. A user id in a
   header, body, or query parameter is never accepted as proof of identity.
4. `SESSION_COOKIE_NAME` stays `ajaia_session` unless the contract is updated.
5. Sessions expire; an expired session must resolve to `null` / throw 401.

## Reference implementation notes

- The raw token is 32 bytes of CSPRNG output, base64url encoded.
- The database stores only the **SHA-256 hash** of the token, never the raw token.
- Expiry is enforced in the query (`expires_at > now()`), not in application code.
- The demo account switcher is gated by `DEMO_MODE=true` and is **not** production
  authentication. It must stay clearly labelled as demo-only.

## Deliberately NOT implemented here

- Passwords, OAuth/SSO, rate limiting on login, account registration, email
  verification, CSRF tokens, and session revocation UI. Those are outside the
  assignment's scope and outside DeepSeek's lane.
