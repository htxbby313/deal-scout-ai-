# Deal Scout profitability operating layer

## Baseline

- Repository: `htxbby313/deal-scout-ai-`
- Application: `personal-deal-scout`
- Implementation branch: `codex/profitability-operating-layer`
- Baseline source: merged `main` at `a783348`
- Stack: Next.js 16 App Router, React 19, TypeScript, Prisma 6, PostgreSQL/Neon, Vitest, Vercel cron
- Existing controls preserved: owner authentication, five-agent team, automatic research, evidence attribution, map/ranking, transaction hold/stop, document versions, immutable transaction audit, and fail-closed outbound providers

## Gap matrix

| Requirement | Existing component | Gap at baseline | Extension | Schema impact | Security/compliance impact | Required proof |
|---|---|---|---|---|---|---|
| Financial truth | `deal-qualification.ts`, transaction target fields | No persisted scenarios, itemized costs, or settlement-backed realized profit | Versioned projections, exact cents, reconciliation and settlement review | Additive projection and settlement models | Realized profit requires reviewed artifact | Calculation, correction and authorization tests |
| Acquisition funnel | Property and transaction statuses | No explicit acquisition stage history or expiring gates | Funnel, immutable history and versioned gates | Additive funnel models | Sensitive stages require current evidence and active control | Transition and concurrency tests |
| Buyer demand | Developer profile and matching | Criteria, POF, pricing freshness and backup coverage incomplete | Versioned demand, capacity, reliability and coverage | Additive buyer-demand models | Unsupported buyer claims cannot become pricing facts | Freshness, score and coverage tests |
| Campaigns | Nationwide research | No bounded owner-approved execution campaign | Versioned geographic/strategy boundaries and limits | Additive campaign models | Execution stays blocked outside approved coverage | Boundary and expiry tests |
| Profit priority | Luxury redevelopment ranking | No cost/probability-adjusted ranking or history | Configurable versioned score with blockers | Additive score history | Scores cannot authorize contact or transaction progression | Reproducibility tests |
| Seller engagement | Draft approvals and disabled providers | No unified consent, suppression or state/channel policy | Draft, consent, suppression and counsel policy records | Additive engagement models | Every unsupported state/channel fails closed | DNC, consent and owner-gate tests |
| Diligence | Property research findings | No explicit preliminary/professional distinction | Two-level evidence reviews | Additive diligence model | Public research never becomes professional conclusion | Evidence and disclaimer tests |
| Provider readiness | `ProviderSetting` | Missing environment/webhook/idempotency readiness evidence | Readiness records and provider contracts | Additive readiness model | Readiness never activates a provider | Fail-closed tests |
| Executive KPIs | Operational pages | No separated pipeline/weighted/realized views | Owner profitability dashboard and exports | Query/index additions only where required | Realized totals use settlement-reviewed records only | Aggregation and access tests |
| Outcomes and learning | Audit events | No structured loss reasons or forecast comparison | Immutable outcomes and review-only observations | Additive outcome models | No automatic production weight changes | Immutability/sample-size tests |

## Delivery phases

1. Financial truth foundation.
2. Funnel, buyer demand and campaigns.
3. Profit-priority score and executive reporting.
4. Seller engagement, consent and suppression.
5. Diligence, settlement ingestion and integration readiness.
6. Outcome learning, full verification and reviewable pull request.

## External blockers retained

- State-specific wholesaling, assignment, disclosure and communications policies require recorded counsel approval.
- Paid providers, e-signature, title, accounting and communication services require owner selection and authorization.
- Production migrations, deployment, merge, outreach, contracts and money movement are outside this implementation branch until separately authorized.
- Public-source research remains subject to access, licensing, robots and applicable-law constraints.
