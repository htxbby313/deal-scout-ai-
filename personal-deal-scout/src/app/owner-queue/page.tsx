import Link from "next/link";
import { TaskReviewControls } from "@/app/agents/agent-dashboard";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { ownerQueueCtaLabel } from "@/lib/deal-cockpit";
import {
  readFunnelOwnerQueue,
  readOwnerAgentActivity,
} from "@/lib/funnel-owner-queue";

export const dynamic = "force-dynamic";
export default async function OwnerQueuePage() {
  await requireOwner();
  const [items, activity] = await Promise.all([
    readFunnelOwnerQueue(),
    readOwnerAgentActivity(),
  ]);
  const firstItem = items[0];
  const kindLabel = (kind: string) =>
    ({
      AGENT_TASK: "Agent recommendation",
      TRANSACTION_APPROVAL: "Deal approval",
      FUNNEL_BLOCKER: "Deal needs attention",
      SELLER_ENGAGEMENT: "Seller draft",
      DEVELOPER_DRAFT: "Developer draft",
      CONTRACT_TEMPLATE: "Contract review",
    })[kind] ?? kind.replaceAll("_", " ");
  const attention = items.length
    ? `${items.length} item${items.length === 1 ? "" : "s"} need a decision.`
    : "You’re caught up. Research continues in the background.";
  return (
    <WorkspaceShell active="owner-queue">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="border-b pb-6">
          <p className="text-sm font-semibold text-blue-700">Home</p>
          <h1 className="mt-1 text-3xl font-bold">What needs attention</h1>
          <p className="mt-2 text-sm text-slate-600">{attention}</p>
          {firstItem ? (
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
              href={firstItem.href}
            >
              {ownerQueueCtaLabel(firstItem.kind)}
            </Link>
          ) : (
            <Link
              className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
              href="/properties"
            >
              Review opportunities
            </Link>
          )}
        </header>
        <section className="mt-6 overflow-hidden rounded-2xl border bg-white">
          <div className="border-b p-5">
            <h2 className="text-xl font-bold">Needs you</h2>
          </div>
          <div className="divide-y">
            {items.map((item) => (
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
            {!items.length ? (
              <div className="p-10 text-center">
                <p className="text-lg font-bold">You’re caught up</p>
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
