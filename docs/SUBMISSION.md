# Submission inventory

## Included in this repository

- [x] Application source: Next.js app shell, editor UI, API routes, service and database
- [x] `README.md` with local setup, environment variable names, demo users, API summary
- [x] `docs/AGENT_CONTRACT.md` — locked API contract v1.0.0
- [x] `docs/ARCHITECTURE.md` — current component and data-flow notes
- [x] `docs/AI_WORKFLOW.md` — actual work and verification record
- [x] `docs/WORK_LOG.md` — decisions, ownership and verification status
- [x] `docs/ASSUMPTIONS.md` — assumptions and contract lock decisions
- [x] `.env.example` with variable names and local development placeholders
- [x] Database migration and seed scripts
- [x] Backend automated tests
- [ ] Screenshot or walkthrough recording — not captured

## Review and release status

- Backend test suite: **35/35 passed** in the current environment.
- Lint: passed. UI-only TypeScript check: passed.
- Full project typecheck: currently blocked by an untracked `scripts/_probe.ts` that
  collides with `scripts/smoke.ts` and contains type errors. The project typecheck passed
  before that file appeared; the probe was left untouched.
- Production build: not verified. Turbopack and Webpack builds failed on sandbox
  permissions while creating generated output under `.next`.
- Local browser walkthrough: not performed.
- Live deployment and durable production persistence: not configured or verified.
- Independent functional/UX and security review: pending.
- Reviewer credentials: the local seeded demo users are listed in `README.md`; they are
  demo-only and are not production credentials.
- Live product URL: **pending**. No URL is claimed.
- Walkthrough URL: see `WALKTHROUGH_URL.txt`; no URL is claimed.

## Remaining release gates

1. Resolve or remove the untracked probe through its owner and restore a clean full
   project typecheck.
2. Run production build and smoke checks in an environment that permits Next.js build
   output and Docker/PostgreSQL access.
3. Browser-test create, format, save, refresh/reopen, import, sharing, viewer mode, and
   unauthorized access against the integrated UI.
4. Obtain independent security and functional/UX review reports and close their P0/P1
   findings.
5. Configure a durable production database, deploy, test persistence with both demo
   roles, and fill in the product and walkthrough URLs.
