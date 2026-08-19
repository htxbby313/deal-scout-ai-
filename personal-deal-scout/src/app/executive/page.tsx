import Link from "next/link";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { readOperationalReport, type OperationalReportFilters } from "@/lib/operational-report-service";

export const dynamic = "force-dynamic";
const field = "rounded-lg border px-3 py-2 text-sm";
function display(value: number | string | null, unit: string) {
  if (value == null) return "Not enough data";
  if (unit === "cents") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) / 100);
  return unit === "percent" ? `${value}%` : unit === "hours" ? `${value} hours` : String(value);
}

export default async function ExecutivePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwner();
  const raw = await searchParams;
  const filters: OperationalReportFilters = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" && value ? [[key, value]] : []));
  const report = await readOperationalReport(filters);
  const query = new URLSearchParams(Object.entries(filters).flatMap(([key, value]) => value ? [[key, value]] : [])).toString();
  return <WorkspaceShell active="executive"><div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-6"><div><p className="text-sm font-semibold text-blue-700">Source-backed operating truth</p><h1 className="mt-1 text-3xl font-bold">Executive results</h1><p className="mt-2 text-sm text-slate-600">Every metric shows its definition, evidence window, sample size, and refresh time. Forecasts are never shown as earned money.</p></div><Link className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white" href={`/api/exports/executive${query ? `?${query}` : ""}`}>Export audited CSV</Link></header>
    <form className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4 xl:grid-cols-8">{[["start","date","Start"],["end","date","End"],["state","text","State"],["county","text","County"],["zip","text","ZIP"],["stage","text","Funnel stage"],["buyerId","text","Buyer ID"],["agentId","text","Agent ID"]].map(([name,type,placeholder])=><input className={field} defaultValue={filters[name as keyof OperationalReportFilters]} key={name} name={name} placeholder={placeholder} type={type}/>) }<button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Apply filters</button></form>
    <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{report.metrics.map((metric) => <article className="rounded-2xl border bg-white p-5" key={metric.key}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p><p className="mt-2 text-2xl font-bold">{display(metric.value, metric.unit)}</p><p className="mt-3 text-xs leading-5 text-slate-600">{metric.definition}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-slate-400">Numerator</dt><dd>{metric.numerator ?? "—"}</dd></div><div><dt className="text-slate-400">Denominator</dt><dd>{metric.denominator ?? "—"}</dd></div><div><dt className="text-slate-400">Sample</dt><dd>{metric.sampleSize}</dd></div><div><dt className="text-slate-400">Refreshed</dt><dd>{new Date(metric.lastRefresh).toLocaleString()}</dd></div></dl>{metric.warning ? <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{metric.warning}</p> : null}</article>)}</section>
    <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">Fallout reasons</h2><div className="mt-3 flex flex-wrap gap-2">{Object.entries(report.falloutReasons).length ? Object.entries(report.falloutReasons).map(([reason, count]) => <span className="rounded-full bg-slate-100 px-3 py-1 text-sm" key={reason}>{reason}: {count}</span>) : <p className="text-sm text-slate-500">No finalized fallout evidence in this window.</p>}</div></section>
  </div></WorkspaceShell>;
}
