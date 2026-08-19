import { WorkspaceShell } from "@/app/workspace-shell";
import { FinancialProjectionForm, SettlementReviewForm } from "@/app/profitability/profitability-forms";
import { requireOwner } from "@/lib/auth";
import { readExecutiveKpis } from "@/lib/executive-kpi-service";
import { readProfitabilityWorkspace } from "@/lib/profitability-service";

export const dynamic = "force-dynamic";
const money = (cents: string | null) => cents == null ? "Insufficient verified data" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(cents) / 100);

export default async function ProfitabilityPage() {
  await requireOwner();
  const [workspace, kpis] = await Promise.all([readProfitabilityWorkspace(), readExecutiveKpis()]);
  const transactions = workspace.rows.map((row) => ({ id: row.id, label: `${row.property} · ${row.market}` }));
  return <WorkspaceShell active="profitability"><div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
    <header className="border-b pb-6"><p className="text-sm font-semibold text-blue-700">Verified financial truth</p><h1 className="mt-1 text-3xl font-bold">Profitability</h1><p className="mt-2 text-sm text-slate-600">Projected, probability-weighted, contracted, and settlement-backed results remain separate. Missing evidence never becomes revenue.</p></header>
    <section className="mt-6 grid gap-4 md:grid-cols-4">{[["Projected pipeline", kpis.financials.projectedBaseCents], ["Probability-weighted", kpis.financials.probabilityWeightedCents], ["Contracted pipeline", kpis.financials.contractedFeeCents], ["Realized closed profit", kpis.financials.realizedProfitCents]].map(([label, value]) => <article className="rounded-2xl border bg-white p-5 shadow-sm" key={label}><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{money(value)}</p></article>)}</section>
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Opportunity results</h2><p className="mt-1 text-sm text-slate-500">Real numbers only. Buyer pricing must be documented and current.</p></div><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Property","Stage","Buyer pricing","Base spread","Weighted value","Seller-safe max","Realized profit","Blocks"].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{workspace.rows.map((row) => <tr key={row.id}><td className="px-4 py-3"><b>{row.property}</b><span className="block text-xs text-slate-500">{row.market}</span></td><td className="px-4 py-3">{row.stage.replaceAll("_", " ")}</td><td className="px-4 py-3">{row.buyerPriceStatus ?? "Missing"}</td><td className="px-4 py-3 font-bold">{money(row.projectedBaseCents)}</td><td className="px-4 py-3">{money(row.probabilityWeightedCents)}</td><td className="px-4 py-3">{money(row.sellerSafeMaximumCents)}</td><td className="px-4 py-3 font-bold text-emerald-800">{money(row.realizedProfitCents)}</td><td className="px-4 py-3">{row.controlStatus === "STOPPED" ? "Stopped" : row.blockers || "None recorded"}</td></tr>)}{!workspace.rows.length ? <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={8}>No transactions exist yet.</td></tr> : null}</tbody></table></div></section>
    <details className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><summary className="cursor-pointer text-lg font-bold">Record an itemized financial scenario</summary><FinancialProjectionForm transactions={transactions} /></details>
    <details className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><summary className="cursor-pointer text-lg font-bold">Record settlement-backed realized profit</summary><SettlementReviewForm transactions={transactions} /></details>
  </div></WorkspaceShell>;
}
