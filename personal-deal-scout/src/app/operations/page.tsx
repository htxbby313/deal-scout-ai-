import { WorkspaceShell } from "@/app/workspace-shell";
import { ResearchNowButton, RunBacklogButton } from "@/app/research-run-controls";
import { requireOwner } from "@/lib/auth";
import { readResearchOperations } from "@/lib/research-operations";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = { QUEUED: "Queued", RUNNING: "Running", COMPLETE: "Complete", NEEDS_MANUAL_VERIFICATION: "Manual verification", FAILED: "Failed" };
const tones: Record<string, string> = { QUEUED: "bg-blue-50 text-blue-800", RUNNING: "bg-violet-50 text-violet-800", COMPLETE: "bg-emerald-50 text-emerald-800", NEEDS_MANUAL_VERIFICATION: "bg-amber-50 text-amber-800", FAILED: "bg-red-50 text-red-800" };
const date = (value: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(value);

function Status({ value = "NOT_STARTED" }: { value?: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tones[value] || "bg-slate-100 text-slate-700"}`}>{labels[value] || "Not started"}</span>;
}

export default async function OperationsPage() {
  await requireOwner();
  const { properties, developers, events } = await readResearchOperations();
  const runs = [...properties.flatMap((item) => item.researchRuns), ...developers.flatMap((item) => item.researchRuns)];
  const count = (status: string) => runs.filter((run) => run.status === status).length;
  return <WorkspaceShell active="operations"><div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-blue-700">Research operations</p><h1 className="mt-1 text-3xl font-bold">Research Queue</h1></div><RunBacklogButton /></header>
    <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Queued", count("QUEUED")], ["Running", count("RUNNING")], ["Complete", count("COMPLETE")], ["Manual verification", count("NEEDS_MANUAL_VERIFICATION")], ["Failed", count("FAILED")]].map(([label, value]) => <article className="rounded-2xl border bg-white p-5 shadow-sm" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></article>)}</section>
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Properties · {properties.length}</h2></div><div className="divide-y">{properties.map((property) => { const run = property.researchRuns[0]; return <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_140px_220px_auto] md:items-center" key={property.id}><div><b>{property.address}</b><p className="text-sm text-slate-500">{property.city}, {property.state}</p></div><Status value={run?.status} /><p className="text-xs text-slate-500">{run ? `${run.findingsFound} found · ${run.sourcesChecked} sources · ${run.manualNeeded} manual · ${date(run.finishedAt || run.startedAt)}` : "No run"}</p><ResearchNowButton id={property.id} kind="property" /></div>})}{!properties.length ? <p className="p-5 text-sm text-slate-500">No active properties.</p> : null}</div></section>
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Developers · {developers.length}</h2></div><div className="divide-y">{developers.map((developer) => { const run = developer.researchRuns[0]; return <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_140px_220px_auto] md:items-center" key={developer.id}><b>{developer.companyName}</b><Status value={run?.status} /><p className="text-xs text-slate-500">{run ? `${run.findingsFound} found · ${run.sourcesChecked} sources · ${run.manualNeeded} manual · ${date(run.finishedAt || run.startedAt)}` : "No run"}</p><ResearchNowButton id={developer.id} kind="developer" /></div>})}{!developers.length ? <p className="p-5 text-sm text-slate-500">No active developers.</p> : null}</div></section>
    <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Recent activity</h2><div className="mt-4 divide-y">{events.map((event) => <div className="py-3" key={event.id}><p className="text-sm font-semibold">{event.summary}</p><p className="mt-1 text-xs text-slate-500">{date(event.createdAt)}</p></div>)}{!events.length ? <p className="text-sm text-slate-500">No research activity yet.</p> : null}</div></section>
  </div></WorkspaceShell>;
}
