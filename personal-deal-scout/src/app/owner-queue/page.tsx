import Link from "next/link";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { readFunnelOwnerQueue } from "@/lib/funnel-owner-queue";

export const dynamic = "force-dynamic";
export default async function OwnerQueuePage() {
  await requireOwner();
  const items = await readFunnelOwnerQueue();
  return <WorkspaceShell active="owner-queue"><div className="mx-auto max-w-5xl px-4 py-6 sm:px-6"><header className="border-b pb-6"><p className="text-sm font-semibold text-blue-700">Consequential work remains human-controlled</p><h1 className="mt-1 text-3xl font-bold">Owner review queue</h1><p className="mt-2 text-sm text-slate-600">Transaction approvals, funnel blockers, seller drafts, and contract artifacts appear together here.</p></header><section className="mt-6 overflow-hidden rounded-2xl border bg-white"><div className="divide-y">{items.map((item)=><Link className="flex items-center justify-between gap-4 p-5 hover:bg-slate-50" href={item.href} key={`${item.kind}-${item.id}`}><span><b className="block">{item.kind.replaceAll("_", " ")}</b><span className="text-sm text-slate-600">{item.label}</span></span><span className={item.urgent ? "font-bold text-red-700" : "text-sm text-slate-500"}>{item.urgent ? "Urgent" : item.createdAt.toLocaleString()}</span></Link>)}{!items.length?<p className="p-8 text-center text-slate-500">Nothing currently requires owner review.</p>:null}</div></section></div></WorkspaceShell>;
}
