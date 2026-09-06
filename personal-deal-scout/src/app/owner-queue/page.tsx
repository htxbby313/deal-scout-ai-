import Link from "next/link";
import { TaskReviewControls } from "@/app/agents/agent-dashboard";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { ownerQueueCtaLabel } from "@/lib/deal-cockpit";
import {
  readFunnelOwnerQueue,
  readOwnerAgentActivity,
} from "@/lib/funnel-owner-queue";
import { scoutBriefing } from "@/lib/scout-briefing";

export const dynamic = "force-dynamic";
export default async function OwnerQueuePage() {
  await requireOwner();
  const [items, activity] = await Promise.all([
    readFunnelOwnerQueue(),
    readOwnerAgentActivity(),
  ]);
  const firstItem = items[0];
  const scout = scoutBriefing(items);
  const kindLabel = (kind: string) =>
    ({
      AGENT_TASK: "Agent recommendation",
      TRANSACTION_APPROVAL: "Deal approval",
      FUNNEL_BLOCKER: "Deal needs attention",
      SELLER_ENGAGEMENT: "Seller draft",
      DEVELOPER_DRAFT: "Developer draft",
      CONTRACT_TEMPLATE: "Contract review",
    })[kind] ?? kind.replaceAll("_", " ");
  const rest = items.slice(1, 9);
  return (
    <WorkspaceShell active="owner-queue">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 lg:py-8">
        <header className="flex flex-col gap-6 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Command Center</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Good morning. Let&apos;s move a deal forward.
            </h1>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {scout.headline}
          </p>
          {scout.lines.length ? (
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              {scout.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {firstItem ? (
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
              href={firstItem.href}
            >
              Continue working
            </Link>
          ) : (
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
              href="/properties"
            >
              Review opportunities
            </Link>
          )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Open priorities</p><p className="mt-2 text-2xl font-bold">{items.length}</p></div>
            <div className="rounded-xl border border-border/70 bg-card p-4"><p className="text-xs font-semibold text-muted-foreground">Agent activity</p><p className="mt-2 text-2xl font-bold">{activity.length}</p></div>
            <div className="col-span-2 rounded-xl border border-border/70 bg-card p-4 sm:col-span-1"><p className="text-xs font-semibold text-muted-foreground">Workspace status</p><p className="mt-2 text-sm font-bold text-emerald-700">Live and monitoring</p></div>
          </div>
        </header>
        <section className="mt-6 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-xl font-bold">Also on deck</h2>
          </div>
          <div className="divide-y">
            {rest.map((item) => (
              <article className="p-5" key={`${item.kind}-${item.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                      {kindLabel(item.kind)}
                    </p>
                    <h3 className="mt-1 font-bold">{item.label}</h3>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                    ) : null}
                  </div>
                  <span
                    className={
                      item.urgent
                        ? "rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700"
                        : "text-xs text-slate-500"
                    }
                  >
                    {item.urgent ? "Urgent" : item.createdAt.toLocaleString()}
                  </span>
                </div>
                {item.kind === "AGENT_TASK" ? (
                  <div className="mt-4">
                    <TaskReviewControls taskId={item.id} />
                  </div>
                ) : (
                  <Link
                    className="mt-4 inline-block rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                    href={item.href}
                  >
                    {ownerQueueCtaLabel(item.kind)}
                  </Link>
                )}
              </article>
            ))}
            {!rest.length ? (
              <div className="p-10 text-center">
                <p className="text-lg font-bold">
                  {firstItem ? "Nothing else on deck" : "You’re caught up"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Research and agent work will continue automatically.
                </p>
              </div>
            ) : null}
          </div>
        </section>
        <details className="mt-6 rounded-2xl border bg-white p-5">
          <summary className="cursor-pointer text-lg font-bold">
            Recent agent activity · {activity.length}
          </summary>
          <div className="mt-3 divide-y">
            {activity.map((event) => (
              <article className="py-3" key={event.id}>
                <p className="text-sm font-semibold">{event.summary}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {event.agentName} · {event.createdAt.toLocaleString()}
                </p>
              </article>
            ))}
            {!activity.length ? (
              <p className="py-5 text-sm text-slate-500">No agent activity yet.</p>
            ) : null}
          </div>
          <Link
            className="mt-3 inline-block text-sm font-bold text-blue-700"
            href="/agents"
          >
            Open agent team
          </Link>
        </details>
      </div>
    </WorkspaceShell>
  );
}
