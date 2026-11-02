# Ajaia architecture

## Runtime shape

The application is a single Next.js 16 App Router project. The React workspace in
`app/page.tsx` calls same-origin route handlers under `app/api/**`. Route handlers derive
identity from the `ajaia_session` httpOnly cookie, validate request input, call the
document service, and return JSON. They do not accept a client-supplied user ID as
identity.

The service layer in `lib/server/documents/service.ts` combines business rules with
server-side authorization through `lib/server/authz/access.ts`. The repository layer in
`lib/server/documents/repository.ts` performs database access. Drizzle maps the four
PostgreSQL tables in `lib/db/schema.ts`: users, sessions, documents, and document members.
Document bodies are TipTap-shaped JSON in a PostgreSQL `jsonb` column. The API contract
and migration are kept alongside the code in `docs/AGENT_CONTRACT.md` and `drizzle/`.

## Identity and permissions

The demo switcher is enabled only when `DEMO_MODE=true`; it creates a normal server-side
session for a seeded user. The browser receives an opaque httpOnly cookie while PostgreSQL
stores only its SHA-256 token hash. This is a reviewer/demo flow, not production login.

Owners and editors can update document content and title. Viewers can read only. Only the
owner can manage sharing or delete a document. Missing and inaccessible documents return
the same 404 response. These checks run in the service/access layer, so UI visibility is
not an authorization boundary.

## Editing and import

The browser editor maps document JSON to escaped HTML for display and maps edited DOM back
to the supported TipTap-shaped nodes and marks. It autosaves through `PATCH`; its status
changes to “Saved” only after a successful response. A failed save offers a retry and
stores an additional local draft for recovery on the same browser. The server still
validates title and JSON limits. Import posts a file to the server, which checks size,
extension, MIME type and text content before converting Markdown or text to structured
content. Imported HTML is not trusted or rendered as HTML.

## Local setup and deployment

For local development, copy `.env.example` to `.env.local`, use a PostgreSQL database,
run `npm run db:migrate` and `npm run db:seed`, then `npm run dev`. Required environment
variable names are listed in `.env.example`; do not commit `.env.local` values.

Production needs a durable managed PostgreSQL database and HTTPS. Set `DATABASE_URL` to
the production database and explicitly decide whether the demo switcher is appropriate;
it should not stand in for real authentication. No live deployment, production database,
or persistent production credentials were available during this integration pass. A
deployment target and persistence check must be supplied and verified before claiming a
production release.

## Known limits

- No real account registration, passwords, OAuth, or SSO.
- No simultaneous real-time editing, invitations, comments, or version history.
- No independent security or functional/UX review has been recorded for this candidate.
- The generated UI could not be browser-verified in this sandbox; Next build output was
  blocked by filesystem permission errors under `.next`.
- The project currently expects each browser to use its own demo session. Cross-user
  collaboration is represented by document membership, not presence or live sync.
