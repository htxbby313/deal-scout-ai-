# CRM and operational-report correctness gap note

Date: 2026-08-21

## Verified affected paths

- `src/app/seller-crm/page.tsx`: server-rendered conversation workspace, list filtering, selected engagement, timeline mapping, mutation forms.
- `src/app/seller-crm-actions.ts`: owner-authenticated engagement, conversation, seller-fact, follow-up, and disposition actions.
- `src/lib/seller-crm.ts`: persisted CRM reads and writes.
- `src/lib/seller-engagement.ts`: engagement draft creation and ownership/transaction checks.
- `prisma/schema.prisma`: `EngagementChannel`, `SellerEngagementStatus`, `SellerFollowUpStatus`, `SellerContactAttemptStatus`, and `SellerDispositionReason` definitions.
- `src/lib/operational-report-service.ts`: scoped data reads and extended operational metrics.
- `src/lib/operational-kpis.ts`: base KPI calculations.
- `src/lib/operational-report-presentation.ts`: section coverage, filter parsing, scope text, formatting, and calculation disclosure.
- `src/lib/operational-report-presentation.test.ts`, `src/lib/operational-kpis.test.ts`, and `tests/operational-report.browser.mjs`: current automated coverage.

## Verified gaps before implementation

1. Friendly channel and disposition labels are rendered without explicit option values, so invalid humanized strings can reach Prisma.
2. Selection falls back to an unfiltered engagement when the visible filtered collection is empty.
3. The conversation form does not submit objections or questions even though the action accepts them.
4. The default Open view does not exclude `COMPLETED` and `CANCELLED` engagements.
5. `recordSellerFactsAction` exists but has no reachable intake form in the conversation workspace.
6. Next-action logic uses the first returned follow-up without excluding terminal follow-up statuses.
7. Draft and approved-but-unsent contact attempts use `createdAt` as a synthetic attempt time and outbound styling.
8. The CRM list query caps each timeline source, so older activity is unreachable.
9. Report scope omits supported property type, lead source, and transaction structure filters.
10. Cost per seller reached divides by conversation count rather than unique reached engagements.
11. Timing metrics expose observation count through generic numerator fields, causing misleading calculation labels.

No schema change is initially required: the existing models and enums can support the requested behavior. Production data and migrations remain untouched.
