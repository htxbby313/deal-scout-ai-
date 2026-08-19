# Deal Scout profitability operating layer — completion audit

Date: 2026-08-19  
Branch: `codex/complete-profitability-brief`  
Owner: Coleman & Co. Holdings LLC  
Status: local implementation complete; production, legal activation, provider activation, and pull request intentionally not performed.

## Scope and truth standard

This audit maps the Deal Scout Profitability Implementation Brief to current, executable evidence. “Complete” below means the safe internal product path exists and was verified. It does not mean a projected deal is profitable, that county data exists where no lawful adapter is configured, or that legal/provider execution is authorized.

The five-agent operating model remains supervised. Research and reversible internal analysis may run automatically. External messages, offers, contracts, funds, and closing instructions remain fail-closed. A stopped transaction is terminal.

## Requirement evidence

| Brief area | Implemented evidence | Verification evidence | Result |
|---|---|---|---|
| Acquisition funnel | Persistent 13-stage funnel; versioned stage policies; explicit entry/exit facts; expiration/review rules; blockers; owner approval; immutable stage history; owner queues and explanations | `stage-criteria.test.ts`, funnel and system integration tests; database trigger inventory; direct STOP restart rejection | Complete |
| Buyer demand and coverage | Versioned market/buy-box criteria; POF status/freshness; permissions; performance evidence; derived reliability scoring; property-specific pricing; distinct primary/backup coverage | Buyer-demand, reliability, evidence-routing, campaign, and integration tests; authenticated `/buyer-evidence` and `/pipeline` render | Complete |
| County-source coverage | Versioned county registry, FIPS coverage, access classifications, accessibility cadence, bounded retries/circuit behavior, campaign coverage sync, county evidence/conflict displays, US map metadata | County policy/accessibility tests; cron tests; authenticated `/county-coverage`, `/research`, property and developer dossier renders | Complete as a fail-closed registry. Counties without a reviewed lawful adapter remain `MANUAL_ONLY`, `RESTRICTED`, `NOT_FOUND`, or `NEEDS_REVIEW`; no coverage is fabricated |
| Financial truth | Exact-cent low/base/high projections; per-cost dated evidence; seller-safe maximum; probability-weighted value; itemized reviewed settlement expenses; immutable corrections; projected/actual reconciliation and time buckets | Financial truth, projection evidence, reconciliation, settlement, accounting export, and system integration tests | Complete |
| Profit priority | Separate Profit-adjusted acquisition priority; versioned configurations and score history; derived source checks; explanations; blockers; stale/stopped/noncompliant exclusions; non-guarantee disclaimer | Profit-priority tests and authenticated `/profit-priority` and `/pipeline` renders | Complete |
| Seller CRM and compliance | Drafts, attempts, sender/provider/disclosure references, consent, suppression, communication windows, seller facts, offers, follow-ups, outcomes, procedures, and training/list-scrub gates | Seller, engagement safety, communication procedure, legacy outbound, and integration tests | Complete internally; outbound stays disabled pending approved state/channel rules and provider setup |
| Campaign economics | Versioned boundaries, county coverage, buyer groups, costs, targets, lifecycle approval/pause, assignment validation, and outbound-disabled enforcement | Campaign economics/lifecycle tests and authenticated `/campaigns` render | Complete |
| Diligence and transactions | Preliminary evidence topics; professional artifact registration; enhanced diligence; document versioning; transaction approvals; owner hold/stop; immutable audit trail | Diligence, transaction policy/control, provider boundary, and direct database trigger tests; authenticated `/transactions` render | Complete internally |
| Contracts and providers | Exact user-supplied purchase/creative-financing and assignment drafts; aligned variable schema; fail-closed compiler; state-versioned hashed registry; counsel/owner activation gates; provider readiness checks; webhook HMAC and idempotency receipts | Contract compiler/policy/provider, webhook security, and migration tests; owner `/contracts` registry | Safe boundary complete; supplied drafts remain `REVIEW_PENDING`, and no state policy or provider is activated |
| Executive reporting | Defined KPIs with windows, samples and refresh times; unit economics; funnel conversion; buyer performance; fallout reasons; segment profit; audited CSV; projections separated from realized profit | KPI/report tests; unauthenticated export returns 401; authenticated `/executive` visual and accessibility verification | Complete |
| Outcome learning | Structured outcome taxonomy; versioned corrections and decision snapshots; prediction-to-result validation; segmented errors; owner-reviewed weight proposals; no automatic application | Outcome, model-validation, immutable-history, and integration tests | Complete |
| Security and governance | Owner authentication, server-side authorization, audit records, immutable histories, terminal STOP trigger, retention/legal-hold hooks, provider webhooks, fail-closed actions | Auth tests, route authorization test, database mutation-denial checks, authenticated route sweep | Complete for the private single-owner architecture |
| Five agents | Exactly five persisted roles; supervised/locked autonomy; evidence-gated internal workflows; deterministic deduplication and bounded retry | Seed query and agent workflow/research recovery/dedup tests | Complete |

## End-to-end verification record

The following ran against a disposable PostgreSQL 18 database on `127.0.0.1:55432`, never against Neon:

- All 37 migrations deployed from an empty database.
- Prisma reported the schema up to date.
- Seed completed and produced exactly five agents, all `LOCKED`, with `autonomousOutbound = false`.
- Direct database attempts to restart a stopped transaction, update/delete a transaction audit event, and update a finalized outcome were rejected by triggers.
- `npm test`: 53 files, 186 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint -- --max-warnings=0`: passed.
- `npm run build`: passed using the repository production build command.
- Visual owner login and `/executive` verification passed at `127.0.0.1:3102`.
- Authenticated HTTP renders returned 200, contained `<main>`, and contained no Next/runtime error text for `/buyer-evidence`, `/campaigns`, `/governance`, `/transactions`, `/profit-priority`, `/pipeline`, `/research`, `/properties`, and `/owner-queue`.
- Unauthenticated `/api/exports/executive` returned 401.

## Deliberately blocked external activation

These are required inputs or explicit owner-authorized external actions, not unfinished safe internal code:

1. State-specific wholesaling, licensing, disclosure, communication, retention, assignment, and double-close rules need recorded counsel approval. Unsupported state/channel combinations remain blocked.
2. The user-supplied acquisition and assignment drafts are preserved and can be registered by property state. Each exact state/version still requires matching-state counsel, closing/title review, and owner approval before activation; registration or compilation cannot execute a document.
3. Communications, e-signature, document storage, title/closing, accounting, insurance, and settlement providers require selected accounts, credentials, reviewed adapters, sandbox proof, and explicit production approval.
4. County automation requires a reviewed, lawful, source-specific adapter with supported endpoints, terms, parser version, rate limits, and coverage. CAPTCHA, paywall, authentication, prohibited automation, ambiguity, and conflicts fail closed to manual verification.
5. No production migration, deployment, purchase, external message, contract execution, fund movement, merge, push, or pull request was performed.

## Operational interpretation

Deal Scout is an evidence-backed acquisitions operating system, not a guaranteed-money button. It can continuously research configured lawful sources, rank supported opportunities, expose missing facts, calculate documented scenarios, control owner decisions, and measure reviewed outcomes. Profit becomes realized only after reviewed settlement evidence; projections and master-class targets never become facts merely because they are plausible.
