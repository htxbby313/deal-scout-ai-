import Link from "next/link";
import { WorkspaceShell } from "@/app/workspace-shell";
import { PageHeader, StatusBadge } from "@/app/ui-foundation";
import { requireOwner } from "@/lib/auth";
import { DemoWorkflow } from "@/app/demo/demo-workflow";

export const dynamic = "force-dynamic";

const steps = [
  ["today", "1", "Today"],
  ["lead", "2", "Open a lead"],
  ["analysis", "3", "Review analysis"],
  ["buyers", "4", "Buyer matches"],
  ["profit", "5", "Projected profit"],
] as const;

export default async function DemoPage() {
  await requireOwner();
  return (
    <WorkspaceShell active="owner-queue">
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <div className="sticky top-2 z-30 mb-5 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <div><StatusBadge>Demo data</StatusBadge><span className="ml-2 text-sm font-semibold text-blue-950">Fictional, read-only, and isolated from your records</span></div>
          <Link className="min-h-10 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white" href="/owner-queue">Exit demo</Link>
        </div>
        <PageHeader eyebrow="Safe product tour" title="See the complete Deal Scout workflow" description="This showcase uses fictional people, properties, conversations, buyers, and deal numbers. It contains no production records and offers no mutation controls." />
        <nav aria-label="Demo steps" className="mt-5 grid gap-2 sm:grid-cols-5">
          {steps.map(([id, number, label]) => <a className="rounded-xl border bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:border-blue-300" href={`#${id}`} key={id}><span className="mr-2 text-blue-700">{number}</span>{label}</a>)}
        </nav>
        <DemoWorkflow />

        <section className="mt-6 rounded-2xl border bg-white p-6" id="today">
          <p className="text-sm font-bold text-blue-700">Step 1 · Today</p>
          <h2 className="mt-1 text-2xl font-bold">Focus on the lead most likely to become a profitable deal</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><DemoMetric label="Leads needing action" value="3" /><DemoMetric label="Projected pipeline" value="$74,500" /><DemoMetric label="Buyer-ready deals" value="2" /></div>
          <div className="mt-5 rounded-xl bg-amber-50 p-4"><b>Next action</b><p className="mt-1 text-sm text-amber-900">Review the fictional Oakview Drive lead. Seller contact and property evidence are ready.</p></div>
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-6" id="lead">
          <p className="text-sm font-bold text-blue-700">Step 2 · High-potential lead</p>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-bold">2147 Oakview Drive</h2><p className="text-slate-500">Fictional Falls, TX 78123</p></div><StatusBadge tone="success">Contact ready</StatusBadge></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3"><DemoMetric label="Seller" value="Jordan Ellis" /><DemoMetric label="Asking price" value="$162,000" /><DemoMetric label="Evidence confidence" value="91%" /></div>
          <div className="mt-5 rounded-xl border p-4"><b>Seller conversation</b><p className="mt-2 text-sm text-slate-600">Jordan is relocating in six weeks and prefers a certain closing date over the highest possible price. Follow-up scheduled for tomorrow at 10:00 AM.</p></div>
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-6" id="analysis">
          <p className="text-sm font-bold text-blue-700">Step 3 · Deal analysis</p><h2 className="mt-1 text-2xl font-bold">The wholesale path has room, with repair risk to verify</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><DemoMetric label="After-repair value" value="$248,000" /><DemoMetric label="Repairs" value="$31,500" /><DemoMetric label="Maximum allowable offer" value="$167,000" /><DemoMetric label="Target assignment fee" value="$18,500" /></div>
          <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-950"><b>Decision:</b> Continue seller follow-up. Confirm roof scope before presenting an offer.</p>
        </section>

        <section className="mt-5 rounded-2xl border bg-white p-6" id="buyers">
          <p className="text-sm font-bold text-blue-700">Step 4 · Buyer matches</p><h2 className="mt-1 text-2xl font-bold">Two fictional buyers match the recorded criteria</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2"><DemoBuyer name="Lone Star Renovation Partners" detail="Single-family · $120k–$210k · verified closing history" score="92" /><DemoBuyer name="Blue Mesa Home Buyers" detail="3+ bedrooms · Comal and Bexar counties · cash" score="84" /></div>
          <p className="mt-4 text-sm text-slate-600">In production, Deal Scout requires verified criteria and an owner-reviewed contact route before preparing outreach.</p>
        </section>

        <section className="mt-5 rounded-2xl border bg-slate-950 p-6 text-white" id="profit">
          <p className="text-sm font-bold text-blue-300">Step 5 · Main business report</p><h2 className="mt-1 text-2xl font-bold">Projected profit stays separate from closed profit</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><DemoMetric dark label="Projected pipeline" value="$74,500" /><DemoMetric dark label="Closed profit" value="$21,000" /><DemoMetric dark label="Lead-to-contract" value="12.5%" /></div>
          <p className="mt-5 text-sm text-slate-300">Tour complete. Exit demo to return to your live workspace. No production data was read or changed on this page.</p>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function DemoMetric({ label, value, dark = false }: { label: string; value: string; dark?: boolean }) {
  return <div className={`rounded-xl p-4 ${dark ? "bg-white/10" : "bg-slate-50"}`}><p className={`text-xs ${dark ? "text-slate-300" : "text-slate-500"}`}>{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function DemoBuyer({ name, detail, score }: { name: string; detail: string; score: string }) {
  return <article className="rounded-xl border p-4"><div className="flex justify-between gap-3"><b>{name}</b><span className="font-bold text-blue-700">{score}%</span></div><p className="mt-2 text-sm text-slate-600">{detail}</p></article>;
}
