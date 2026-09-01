import Link from "next/link";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { readOperatingLayer } from "@/lib/operating-layer";
import { PipelineForms } from "@/app/pipeline/pipeline-forms";
import { DealWorkspace } from "@/app/pipeline/deal-workspace";
import { PageHeader } from "@/app/ui-foundation";

export const dynamic = "force-dynamic";
export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; status?: string; rank?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const data = await readOperatingLayer(params);
  return (
    <WorkspaceShell active="pipeline">
      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader eyebrow="Deals" title="Move the right deals toward closing" description="See each active acquisition in six clear stages, understand the next action, and open the full analysis only when needed." />
        <DealWorkspace deals={data.funnels} />
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
