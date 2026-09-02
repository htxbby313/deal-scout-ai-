import Link from "next/link";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import {
  readOperationalReport,
  type OperationalReportFilters,
} from "@/lib/operational-report-service";
import { OutcomeControls } from "@/app/executive/outcome-controls";
import type { Metric } from "@/lib/operational-kpis";
import {
  formatOperationalValue,
  hasActiveOperationalFilters,
  metricCalculationDetails,
  operationalScopeParts,
  organizeOperationalMetrics,
  parseOperationalReportFilters,
} from "@/lib/operational-report-presentation";
import { EmptyState, PageHeader } from "@/app/ui-foundation";

export const dynamic = "force-dynamic";
const field = "rounded-lg border px-3 py-2 text-sm";
function MetricCard({
  metric,
  scope,
  compact = false,
}: {
  metric: Metric;
  scope: string[];
  compact?: boolean;
}) {
  const calculation = metricCalculationDetails(metric);
  return (
    <article
      className={`rounded-2xl border bg-white ${compact ? "p-4" : "p-5"}`}
      data-metric-key={metric.key}
    >
      <p className="text-sm font-semibold text-slate-600">{metric.label}</p>
      <p className={`${compact ? "text-xl" : "text-2xl"} mt-2 font-bold`}>
        {formatOperationalValue(metric.value, metric.unit)}
      </p>
      {metric.warning ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {metric.warning}
        </p>
      ) : null}
      {compact ? null : (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold">
            How this is calculated
          </summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-semibold">Definition</dt>
            <dd>{calculation.definition}</dd>
            {calculation.numerator ? (
              <>
                <dt className="font-semibold">{calculation.numerator.label}</dt>
                <dd>{calculation.numerator.value}</dd>
              </>
            ) : null}
            {calculation.denominator ? (
              <>
                <dt className="font-semibold">
                  {calculation.denominator.label}
                </dt>
                <dd>{calculation.denominator.value}</dd>
              </>
            ) : null}
            {calculation.formula ? (
              <>
                <dt className="font-semibold">Formula</dt>
                <dd>{calculation.formula}</dd>
              </>
            ) : null}
            <dt className="font-semibold">Sample size</dt>
            <dd>{metric.sampleSize}</dd>
            <dt className="font-semibold">Refreshed</dt>
            <dd>{new Date(metric.lastRefresh).toLocaleString()}</dd>
            <dt className="font-semibold">Scope</dt>
            <dd>{scope.join(" · ")}</dd>
          </dl>
        </details>
      )}
    </article>
  );
}
export default async function ExecutivePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireOwner();
  const raw = await searchParams;
  const filters: OperationalReportFilters = parseOperationalReportFilters(
    Object.entries(raw).flatMap(([key, value]) =>
      typeof value === "string" ? [[key, value] as [string, string]] : [],
    ),
  );
  const report = await readOperationalReport(filters);
  const sections = organizeOperationalMetrics(report.metrics);
  const headlineKeys = new Set([
    "projected_pipeline",
    "realized_profit",
    "properties_discovered",
    "deals_closed",
    "seller_contract_conversion_rate",
    "deals_lost",
  ]);
  const headlineMetrics = report.metrics.filter((metric) =>
    headlineKeys.has(metric.key),
  );
  const detailSections = sections
    .map((section) => ({
      ...section,
      metrics: section.metrics.filter(
        (metric) => !headlineKeys.has(metric.key),
      ),
    }))
    .filter((section) => section.metrics.length);
  const filtersActive = hasActiveOperationalFilters(filters);
  const scope = operationalScopeParts(
    filters,
    report.metrics[0]?.windowStart,
    report.metrics[0]?.windowEnd,
  );
  const query = new URLSearchParams(
    Object.entries(filters).flatMap(([key, value]) =>
      value ? [[key, value]] : [],
    ),
  ).toString();
  const stageKeys = [
    ["properties_discovered", "Leads found"],
    ["properties_researched", "Researched"],
    ["sellers_reached", "Sellers reached"],
    ["offers_prepared", "Offers prepared"],
    ["contracts_signed", "Under contract"],
    ["deals_closed", "Closed"],
  ] as const;
  const stageMetrics = stageKeys.map(([key, label]) => ({
    label,
    metric: report.metrics.find((metric) => metric.key === key),
  }));
  const stageMaximum = Math.max(1, ...stageMetrics.map(({ metric }) => Number(metric?.value ?? 0)));
  const businessSegments = Object.entries(report.profitSegments).filter(([dimension]) => ["market", "leadSource"].includes(dimension));
  return (
    <WorkspaceShell active="executive">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <PageHeader eyebrow="Reports" title="Know what is working and where deals are getting stuck" description="See potential profit, closed results, conversion, source performance, and fallout—using only recorded Deal Scout activity." actions={<Link className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href={`/api/exports/executive${query ? `?${query}` : ""}`}>Download report</Link>} />
        <div className="mt-4">
            <div
              aria-label="Active report scope"
              className="flex flex-wrap gap-2"
            >
              {scope.map((part) => (
                <span
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                  key={part}
                >
                  {part}
                </span>
              ))}
            </div>
        </div>
        <details
          className="mt-6 rounded-2xl border bg-white p-4"
          open={filtersActive}
        >
          <summary className="cursor-pointer font-bold">
            Filter this report{filtersActive ? " — active" : ""}
          </summary>
          <form className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-6">
            {[
              ["start", "date", "Start"],
              ["end", "date", "End"],
              ["state", "text", "State"],
              ["county", "text", "County"],
              ["zip", "text", "ZIP"],
              ["stage", "text", "Deal stage"],
              ["buyerId", "text", "Buyer"],
              ["agentId", "text", "Agent"],
              ["propertyType", "text", "Property type"],
              ["leadSource", "text", "Lead source"],
              ["transactionStructure", "text", "Deal structure"],
            ].map(([name, type, placeholder]) => (
              <input
                className={field}
                defaultValue={filters[name as keyof OperationalReportFilters]}
                key={name}
                name={name}
                placeholder={placeholder}
                type={type}
              />
            ))}
            <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
              Update report
            </button>
            {filtersActive ? (
              <Link
                className="rounded-lg border px-4 py-2 text-center text-sm font-semibold text-slate-700"
                href="/executive"
              >
                Clear filters
              </Link>
            ) : null}
          </form>
        </details>
        <section aria-labelledby="report-headlines" className="mt-6">
          <h2 className="text-xl font-bold" id="report-headlines">At a glance</h2>
          <p className="mt-1 text-sm text-slate-500">
            Money, active opportunity progress, and the current research
            backlog.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {headlineMetrics.map((metric) => (
              <MetricCard
                compact
                key={metric.key}
                metric={metric}
                scope={scope}
              />
            ))}
          </div>
        </section>
        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_1.15fr]">
          <article className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-bold">Lead-to-close progress</h2>
            <p className="mt-1 text-sm text-slate-500">Recorded counts at the major acquisition milestones.</p>
            <div className="mt-5 space-y-4">
              {stageMetrics.map(({ label, metric }) => (
                <div key={label}>
                  <div className="flex justify-between gap-3 text-sm"><span>{label}</span><b>{formatOperationalValue(metric?.value ?? 0, metric?.unit ?? "count")}</b></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-700" style={{ width: `${Math.max(2, (Number(metric?.value ?? 0) / stageMaximum) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-bold">Best markets and lead sources</h2>
            <p className="mt-1 text-sm text-slate-500">Projected and closed profit remain separate. Unspecified means the source was not recorded.</p>
            {businessSegments.some(([, rows]) => rows.length) ? <div className="mt-4 grid gap-4 sm:grid-cols-2">{businessSegments.map(([dimension, rows]) => <div className="overflow-hidden rounded-xl border" key={dimension}><h3 className="bg-slate-50 px-3 py-2 text-sm font-bold">{dimension === "leadSource" ? "Lead sources" : "Markets"}</h3><div className="divide-y">{rows.slice(0, 5).map((row) => <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 text-sm" key={row.key}><div><b>{row.key === "UNSPECIFIED" ? "Not recorded" : row.key}</b><p className="text-xs text-slate-500">{row.dealCount} deal{row.dealCount === 1 ? "" : "s"}</p></div><div className="text-right"><b>{formatOperationalValue(row.projectedCents, "cents")}</b><p className="text-xs text-emerald-700">{formatOperationalValue(row.realizedCents, "cents")} closed</p></div></div>)}</div></div>)}</div> : <div className="mt-4"><EmptyState title="No source performance yet" description="Lead-source and market results will appear after deals have recorded projections or closed profit." /></div>}
          </article>
        </section>
        <details className="mt-6 rounded-2xl border bg-white p-5">
          <summary className="cursor-pointer text-lg font-bold">
            Advanced reporting ·{" "}
            {report.metrics.length - headlineMetrics.length}
          </summary>
          <p className="mt-1 text-sm text-slate-500">
            Metric definitions, sample sizes, costs, timing, forecasting, and diagnostics.
          </p>
          {detailSections.map((section) => (
            <section className="mt-6" key={section.title}>
              <div>
                <h2 className="text-xl font-bold">{section.title}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {section.description}
                </p>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.metrics.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} scope={scope} />
                ))}
              </div>
            </section>
          ))}
        </details>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">Fallout reasons</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(report.falloutReasons).length ? (
              Object.entries(report.falloutReasons).map(([reason, count]) => (
                <span
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm"
                  key={reason}
                >
                  {reason}: {count}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                No finalized fallout evidence in this window.
              </p>
            )}
          </div>
        </section>
        <details className="mt-6 rounded-2xl border bg-white p-5">
          <summary className="cursor-pointer font-bold">
            Full profit segmentation
          </summary>
          <p className="mt-2 text-sm text-slate-500">
            Projected and closed profit remain separate.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {Object.entries(report.profitSegments).map(([dimension, rows]) => (
              <div
                className="overflow-hidden rounded-xl border"
                key={dimension}
              >
                <h3 className="bg-slate-50 px-3 py-2 text-sm font-bold capitalize">
                  {dimension}
                </h3>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr>
                      <th className="px-3 py-2">Segment</th>
                      <th className="px-3 py-2">Projected</th>
                      <th className="px-3 py-2">Realized</th>
                      <th className="px-3 py-2">Deals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr className="border-t" key={row.key}>
                        <td className="px-3 py-2">{row.key}</td>
                        <td className="px-3 py-2">
                          {formatOperationalValue(row.projectedCents, "cents")}
                        </td>
                        <td className="px-3 py-2">
                          {formatOperationalValue(row.realizedCents, "cents")}
                        </td>
                        <td className="px-3 py-2">
                          {row.dealCount} / {row.realizedCount} closed
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </details>
        <details className="mt-6 rounded-2xl border bg-white p-5">
          <summary className="cursor-pointer font-bold">
            Forecast accuracy
          </summary>
          <p className="mt-2 text-sm text-slate-500">
            This advanced view compares prior predictions with finalized
            outcomes.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th>Dimension</th>
                  <th>Segment</th>
                  <th>Final</th>
                  <th>Financial pairs</th>
                  <th>Financial MAE</th>
                  <th>Probability pairs</th>
                  <th>Probability MAE</th>
                </tr>
              </thead>
              <tbody>
                {report.forecastErrors.map((row) => (
                  <tr className="border-t" key={`${row.dimension}:${row.key}`}>
                    <td className="py-2">{row.dimension}</td>
                    <td>{row.key}</td>
                    <td>{row.finalizedSampleSize}</td>
                    <td>{row.financialPairedSampleSize}</td>
                    <td>
                      {row.meanAbsoluteFinancialError == null
                        ? "Not enough data"
                        : formatOperationalValue(
                            row.meanAbsoluteFinancialError,
                            "cents",
                          )}
                    </td>
                    <td>{row.probabilityPairedSampleSize}</td>
                    <td>
                      {row.meanAbsoluteProbabilityErrorBps == null
                        ? "Not enough data"
                        : `${row.meanAbsoluteProbabilityErrorBps} bps`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <details className="mt-6 rounded-2xl border bg-white p-5">
          <summary className="cursor-pointer font-bold">
            Record final outcomes and model reviews
          </summary>
          <div className="mt-4">
            <OutcomeControls />
          </div>
        </details>
      </div>
    </WorkspaceShell>
  );
}
