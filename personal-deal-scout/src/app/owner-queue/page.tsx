import Link from "next/link";
import { TaskReviewControls } from "@/app/agents/agent-dashboard";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import {
  readFunnelOwnerQueue,
  readOwnerAgentActivity,
} from "@/lib/funnel-owner-queue";
import { humanLabel } from "@/lib/presentation";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export default async function OwnerQueuePage() {
  await requireOwner();
  const [items, activity, pipelineScores, leadCount] = await Promise.all([
    readFunnelOwnerQueue(),
    readOwnerAgentActivity(),
    getPrisma().profitPriorityScoreHistory.findMany({
      distinct: ["funnelId"],
      orderBy: { calculatedAt: "desc" },
      select: { projectedBaseCents: true },
    }),
    getPrisma().property.count({ where: { opportunityStatus: { not: "REJECTED" } } }),
  ]);
  const agentTasks = items.filter((item) => item.kind === "AGENT_TASK");
  const dealItems = items.length - agentTasks.length;
  const firstItem = items[0];
  const problemEvents = activity.filter((event) =>
    /gap|fail|block|missing|manual/i.test(event.summary),
  );
  const offersPending = items.filter((item) => ["TRANSACTION_APPROVAL", "CONTRACT_TEMPLATE"].includes(item.kind)).length;
  const projectedPipelineCents = pipelineScores.reduce((sum, score) => sum + score.projectedBaseCents, BigInt(0));
  const projectedPipeline = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(projectedPipelineCents) / 100);
  const today = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "America/Chicago" }).format(new Date());
  const kindLabel = (kind: string) =>
    ({
      AGENT_TASK: "Suggested action",
      TRANSACTION_APPROVAL: "Deal approval",
      FUNNEL_BLOCKER: "Deal needs attention",
      SELLER_ENGAGEMENT: "Seller follow-up",
      DEVELOPER_DRAFT: "Buyer follow-up",
      CONTRACT_TEMPLATE: "Contract review",
    })[kind] ?? humanLabel(kind);
  return (
    <WorkspaceShell active="owner-queue">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <header className="border-b pb-6">
          <p className="text-sm font-semibold text-blue-700">{today}</p>
          <h1 className="mt-1 text-3xl font-bold">
            What needs attention today
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {items.length
              ? `${items.length} item${items.length === 1 ? "" : "s"} need your attention: ${dealItems} deal decision${dealItems === 1 ? "" : "s"} and ${agentTasks.length} agent recommendation${agentTasks.length === 1 ? "" : "s"}.`
              : "You’re caught up. Research continues automatically in the background."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
              href={firstItem?.href ?? "/properties"}
            >
              {firstItem ? "Continue working" : "Review opportunities"}
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-400"
              href="/seller-crm"
            >
              Open conversations
            </Link>
          </div>
          <form action="/properties" className="mt-4 flex max-w-xl gap-2" method="get" role="search">
            <label className="sr-only" htmlFor="global-search">Search Deal Scout</label>
            <input className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm" id="global-search" name="q" placeholder="Search address, seller, phone, or market" />
            <button className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">Search</button>
          </form>
        </header>
        <section
          aria-label="Owner summary"
          className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <article className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Leads needing action</p>
            <p className="mt-2 text-3xl font-bold">{dealItems}</p>
          </article>
          <article className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Follow-ups due</p>
            <p className="mt-2 text-3xl font-bold">{problemEvents.length}</p>
          </article>
          <article className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Offers pending</p>
            <p className="mt-2 text-3xl font-bold">{offersPending}</p>
          </article>
          <article className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-slate-500">Projected pipeline profit</p>
            <p className="mt-2 text-3xl font-bold">{projectedPipeline}</p>
          </article>
        </section>
        {leadCount === 0 ? (
          <section className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="text-lg font-bold">Get started in three steps</h2>
            <ol className="mt-4 grid gap-3 md:grid-cols-3">
              <li className="rounded-xl bg-white p-4"><b>1. Add or import leads</b><p className="mt-1 text-sm text-slate-600">Start with a property address.</p><Link className="mt-3 inline-block text-sm font-bold text-blue-700" href="/properties#add-lead">Add a lead</Link></li>
              <li className="rounded-xl bg-white p-4"><b>2. Review the research</b><p className="mt-1 text-sm text-slate-600">See what is verified and what is missing.</p><Link className="mt-3 inline-block text-sm font-bold text-blue-700" href="/properties">Open leads</Link></li>
              <li className="rounded-xl bg-white p-4"><b>3. Add a buyer</b><p className="mt-1 text-sm text-slate-600">Capture criteria for matching deals.</p><Link className="mt-3 inline-block text-sm font-bold text-blue-700" href="/developers">Open buyers</Link></li>
            </ol>
          </section>
        ) : null}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
          <section className="overflow-hidden rounded-2xl border bg-white">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-xl font-bold">Needs you</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {dealItems} deal item{dealItems === 1 ? "" : "s"} and{" "}
                  {agentTasks.length} agent recommendation
                  {agentTasks.length === 1 ? "" : "s"}
                </p>
              </div>
              <Link className="text-sm font-bold text-blue-700" href="/agents">
                View team
              </Link>
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
                        <p className="mt-1 text-sm text-slate-500">
                          {item.detail}
                        </p>
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
                      Review
                    </Link>
                  )}
                </article>
              ))}
              {!items.length && problemEvents.length ? (
                <div className="p-10 text-center">
                  <p className="text-lg font-bold">No approvals waiting</p>
                  <p className="mt-1 text-sm text-amber-800">
                    Agents are still working through {problemEvents.length}{" "}
                    recent research problem
                    {problemEvents.length === 1 ? "" : "s"}. Open agent activity
                    for details.
                  </p>
                </div>
              ) : !items.length ? (
                <div className="p-10 text-center">
                  <p className="text-lg font-bold">You’re caught up</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Research and agent work will continue automatically.
                  </p>
                </div>
              ) : null}
            </div>
          </section>
          <details className="h-fit rounded-2xl border bg-white p-5">
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
                <p className="py-5 text-sm text-slate-500">
                  No agent activity yet.
                </p>
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
      </div>
    </WorkspaceShell>
  );
}
