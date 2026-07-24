# Deal Scout AI

Deal Scout AI is a private, owner-operated real-estate research and acquisitions dashboard. It tracks candidate properties, leads, follow-up tasks, developer history and matching, draft outreach approvals, provider safety settings, and an audit trail.

## Current features

- Existing dashboard and foreclosure CSV import
- Property, lead, task, developer, and developer-project tracking
- Reproducible developer-match scoring with persisted results
- Message templates and explicit approval/rejection workflow
- PostgreSQL persistence through Prisma
- Private single-owner authentication
- Audit logging and fail-closed provider adapters
- `RESEARCH` mode and disabled SMS, email, and voice providers by default

No provider integration is fabricated or enabled. Outbound attempts require an approved message, `ACTIVE` mode, an enabled and configured provider record, the corresponding environment credential, and a real reviewed adapter. Since no adapter is selected yet, sends remain blocked.

## Local setup

1. Install Node.js 20.9 or newer and PostgreSQL.
2. Copy `.env.example` to `.env` and replace every placeholder.
3. Run `npm install`.
4. Run `npm run db:generate`.
5. Run `npm run db:migrate`.
6. Run `npm run db:seed`.
7. Run `npm run dev`, then sign in with `OWNER_USERNAME` and `OWNER_PASSWORD`.

`SESSION_SECRET` must be at least 32 characters. Do not commit `.env`.

## Database, migrations, and seed

The production target is PostgreSQL through `DATABASE_URL`.

- Development migration: `npm run db:migrate`
- Production migration: `npm run db:migrate:deploy`
- Migration status: `npm run db:status`
- Safe seed: `npm run db:seed`
- Regenerate client: `npm run db:generate`

The seed is idempotent for system/provider defaults and always enforces `RESEARCH` with SMS, email, and voice disabled. Before deploying, provision PostgreSQL, set `DATABASE_URL`, run `npm run db:migrate:deploy`, and run `npm run db:seed`.

## Environment variables

See `.env.example`. Required production values are `DATABASE_URL`, `OWNER_USERNAME`, `OWNER_PASSWORD`, and a 32+ character `SESSION_SECRET`. Provider enable flags default to false. Provider credentials should remain unset until the provider and adapter have been reviewed.

## Safety modes

- `RESEARCH` (default): research, scoring, drafts, and approvals only; sends blocked.
- `PAUSED`: operational pause; sends blocked.
- `ACTIVE`: still requires explicit approval, enabled/configured provider settings, verified environment credentials, and a real adapter.

## Quality checks

Run:

```text
npm test
npm run lint
npm run build
```

## Deployment requirements

Use a persistent PostgreSQL database, HTTPS, secure environment-secret storage, Node.js 20.9+, migration execution before application start, and a process/runtime capable of serving Next.js. Keep the application private. Do not enable outbound messaging until a provider is selected, credentials are verified, compliance requirements are satisfied, and the adapter has been reviewed and tested.
