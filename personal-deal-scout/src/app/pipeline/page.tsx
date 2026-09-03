import Link from "next/link";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import {
  acquisitionStageLabel,
  isLostOrNurtureStage,
} from "@/lib/deal-cockpit";
import { readOperatingLayer } from "@/lib/operating-layer";
import { PipelineForms } from "@/app/pipeline/pipeline-forms";

export const dynamic = "force-dynamic";
const stages = [
  "DISCOVERED",
  "RESEARCHABLE",
  "BUYER_FIT",
  "OUTREACH_READY",
  "SELLER_ENGAGED",
  "UNDERWRITING_READY",
  "OFFER_READY",
  "CONTRACTED",
  "DISPOSITION_READY",
  "CLOSED",
  "DISQUALIFIED",
  "NURTURE",
  "ARCHIVED",
];

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; status?: string; rank?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const data = await readOperatingLayer(params);
  const activeFunnels = data.funnels.filter(
    (funnel) => !isLostOrNurtureStage(funnel.stage),
  );
  const lostFunnels = data.funnels.filter((funnel) =>
    isLostOrNurtureStage(funnel.stage),
  );
  return (
    <WorkspaceShell active="pipeline">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b pb-6">
          <p className="text-sm font-semibold text-blue-700">Deal workflow</p>
          <h1 className="mt-1 text-3xl font-bold">Deals</h1>
          <p className="mt-2 text-sm text-slate-600">
            See where every opportunity stands, what is blocking it, and what
            should happen next.
          </p>
        </header>
        <form className="mt-6 grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-4">
          <select
            className="rounded-lg border px-3 py-2"
            defaultValue={params.stage}
            name="stage"
          >
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {acquisitionStageLabel(stage)}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            defaultValue={params.status}
            name="status"
          >
            <option value="">All campaign statuses</option>
            {[
              "DRAFT",
              "PENDING_APPROVAL",
              "APPROVED",
              "ACTIVE",
              "PAUSED",
              "COMPLETED",
              "CANCELLED",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <select
            className="rounded-lg border px-3 py-2"
            defaultValue={params.rank}
            name="rank"
          >
            <option value="">Current activity order</option>
            <option value="profit-priority">
              Profit-adjusted acquisition priority
            </option>
          </select>
          <button className="rounded-lg bg-slate-950 px-4 py-2 font-bold text-white">
            Apply filters
          </button>
        </form>
        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-xl font-bold">
              Opportunities · {activeFunnels.length}
            </h2>
          </div>
          <div className="divide-y">
            {activeFunnels.map((funnel) => (
              <article
                className="grid gap-3 p-5 md:grid-cols-[1.4fr_1fr_1fr_1fr]"
                key={funnel.id}
              >
                <div>
                  <b>{funnel.property}</b>
                  <p className="text-xs text-slate-500">{funnel.market}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Stage</span>
                  <b className="block">{acquisitionStageLabel(funnel.stage)}</b>
                </div>
                <div>
                  <span className="text-xs text-slate-500">Buyer matches</span>
                  <b className="block">
                    {funnel.buyerCoverage
                      ? `${funnel.buyerCoverage} confirmed`
                      : "No buyer confirmed"}
                  </b>
                  <span className="text-xs text-slate-500">
                    Deal priority: {funnel.score ?? "not scored yet"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500">
                    What is needed next
                  </span>
                  <b className="block text-amber-800">
                    {funnel.blockers.length
                      ? funnel.blockers
                          .map((blocker) => blocker.replaceAll("_", " "))
                          .join(", ")
                      : "Open Deal Desk for next action"}
                  </b>
                </div>
                <p className="text-xs text-slate-500 md:col-span-4">
                  {funnel.reason}
                </p>
                <div className="md:col-span-4">
                  <Link
                    className="inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
                    href={`/deals/${funnel.propertyId}`}
                  >
                    Open Deal Desk
                  </Link>
                </div>
              </article>
            ))}
            {!activeFunnels.length ? (
              <p className="p-8 text-center text-slate-500">
                No opportunities match these filters.
              </p>
            ) : null}
          </div>
        </section>
        {lostFunnels.length ? (
          <details className="mt-6 rounded-2xl border bg-white p-5">
            <summary className="cursor-pointer text-lg font-bold">
              Lost / Nurture · {lostFunnels.length}
            </summary>
            <div className="mt-3 divide-y">
              {lostFunnels.map((funnel) => (
                <article className="py-3" key={funnel.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <b>{funnel.property}</b>
                      <p className="text-xs text-slate-500">
                        {acquisitionStageLabel(funnel.stage)}
                      </p>
                    </div>
                    <Link
                      className="text-sm font-bold text-blue-700"
                      href={`/deals/${funnel.propertyId}`}
                    >
                      Open Deal Box
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </details>
        ) : null}
        <details className="mt-6 rounded-2xl border bg-white p-5">
          <summary className="cursor-pointer text-lg font-bold">
            Buyer demand, campaigns & readiness
          </summary>
          <p className="mt-1 text-sm text-slate-500">
            Supporting deal operations. Open only when you need the underlying
            buyer evidence, campaign status, or provider readiness.
          </p>
          <section className="mt-5 grid gap-6 xl:grid-cols-2">
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold">
                Buyer demand · {data.buyerDemand.length}
              </h2>
              <div className="mt-3 divide-y">
                {data.buyerDemand.map((demand) => (
                  <div className="py-3" key={demand.id}>
                    <div className="flex justify-between">
                      <b>{demand.developer}</b>
                      <span>{demand.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Version {demand.version} ·{" "}
                      {demand.markets.join(", ") || "No verified market"}
                    </p>
                    <Link
                      className="text-xs font-bold text-blue-700 underline"
                      href={demand.sourceUrl}
                    >
                      Open evidence
                    </Link>
                  </div>
                ))}
                {!data.buyerDemand.length ? (
                  <p className="text-sm text-slate-500">
                    No versioned buyer-demand evidence.
                  </p>
                ) : null}
              </div>
            </article>
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold">
                Campaigns · {data.campaigns.length}
              </h2>
              <div className="mt-3 divide-y">
                {data.campaigns.map((campaign) => (
                  <div className="py-3" key={campaign.id}>
                    <div className="flex justify-between">
                      <b>{campaign.name}</b>
                      <span>{campaign.status}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {campaign.state} · owner{" "}
                      {campaign.ownerApproved ? "approved" : "not approved"} ·
                      outbound{" "}
                      {campaign.outboundEnabled ? "enabled" : "disabled"}
                    </p>
                  </div>
                ))}
                {!data.campaigns.length ? (
                  <p className="text-sm text-slate-500">
                    No execution campaigns. Nationwide research remains active.
                  </p>
                ) : null}
              </div>
            </article>
          </section>
          <section className="mt-6 grid gap-6 xl:grid-cols-3">
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-bold">Seller engagement</h2>
              <p className="mt-2 text-3xl font-bold">
                {data.engagements.length}
              </p>
              <p className="text-xs text-slate-500">
                Drafts and reviewed records; no autonomous delivery.
              </p>
            </article>
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-bold">Diligence reviews</h2>
              <p className="mt-2 text-3xl font-bold">{data.diligence.length}</p>
              <p className="text-xs text-slate-500">
                Preliminary and professional evidence remain distinct.
              </p>
            </article>
            <article className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="font-bold">Provider readiness</h2>
              <p className="mt-2 text-3xl font-bold">
                {
                  data.providers.filter(
                    (provider) => provider.status === "READY",
                  ).length
                }
                /{data.providers.length}
              </p>
              <p className="text-xs text-slate-500">
                Readiness never activates a provider.
              </p>
            </article>
          </section>
        </details>
        <details className="mt-6 rounded-2xl border bg-white p-5">
          <summary className="cursor-pointer text-lg font-bold">
            Advanced deal setup
          </summary>
          <p className="mt-1 text-sm text-slate-500">
            Stage policies, buyer evidence, campaigns, pricing, and other
            administrative controls.
          </p>
          <PipelineForms
            funnels={data.funnels.map(({ id, property }) => ({ id, property }))}
            developers={data.developers}
            buyerDemand={data.buyerDemand.map(
              ({ id, developerId, developer, version }) => ({
                id,
                developerId,
                developer,
                version,
              }),
            )}
            stagePolicies={data.stagePolicies}
          />
        </details>
      </div>
    </WorkspaceShell>
  );
}
