import {
  assignCampaignAgentAction,
  assignCampaignOpportunityAction,
  createCampaignGoalAction,
  recordCampaignCostAction,
} from "@/app/campaign-actions";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { buildCampaignKpis } from "@/lib/campaign-economics";
import { readCampaignWorkspace } from "@/lib/campaign-service";
import { CampaignLifecycleControls } from "@/app/campaigns/campaign-lifecycle-controls";
export const dynamic = "force-dynamic";
const field = "rounded-lg border px-3 py-2 text-sm";
const money = (v: bigint) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(v) / 100,
  );
export default async function CampaignsPage() {
  await requireOwner();
  const [campaigns, funnels, agents] = await readCampaignWorkspace();
  return (
    <WorkspaceShell active="campaigns">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
        <header className="border-b pb-6">
          <p className="text-sm font-semibold text-blue-700">
            Bounded execution focus
          </p>
          <h1 className="mt-1 text-3xl font-bold">Operating campaigns</h1>
          <p className="mt-2 text-sm text-slate-600">
            Nationwide research remains available; execution requires active
            approved campaign coverage.
          </p>
        </header>
        <CampaignLifecycleControls campaigns={campaigns} />
        <section className="mt-6 grid gap-5">
          {campaigns.map((c) => {
            const k = buildCampaignKpis({
              opportunities: c.opportunities.map((o) => ({
                stage: o.funnel.stage,
                realizedProfitCents:
                  o.funnel.transaction?.settlementReviews[0]
                    ?.realizedProfitCents,
              })),
              costs: c.costs,
              goals: c.goals[0],
            });
            const b = c.boundaries[0];
            return (
              <article className="rounded-2xl border bg-white p-5" key={c.id}>
                <div className="flex justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{c.name}</h2>
                    <p className="text-xs text-slate-500">
                      {c.status} · {c.jurisdictionState} · outbound{" "}
                      {c.outboundEnabled ? "enabled" : "disabled"}
                    </p>
                  </div>
                  <b>{money(k.netAfterAttributedCostCents)}</b>
                </div>
                <p className="mt-3 text-sm">
                  {b
                    ? [
                        ...b.allowedStates,
                        ...b.allowedCounties,
                        ...b.allowedCities,
                        ...b.allowedZipCodes,
                      ].join(" · ")
                    : "No boundary"}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-3 text-sm">
                  <span>{k.opportunityCount} opportunities</span>
                  <span>{k.closed} closed</span>
                  <span>{money(k.realizedProfitCents)} realized</span>
                  <span>{money(k.attributedCostCents)} costs</span>
                </div>
              </article>
            );
          })}
        </section>
        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <form
            action={assignCampaignOpportunityAction}
            className="space-y-3 rounded-2xl border bg-white p-5"
          >
            <h2 className="font-bold">Assign opportunity</h2>
            <select className={`${field} w-full`} name="campaignId" required>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className={`${field} w-full`} name="funnelId" required>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.property.address}
                </option>
              ))}
            </select>
            <textarea
              className={`${field} w-full`}
              name="reason"
              placeholder="Evidence-backed reason"
              required
            />
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-white">
              Assign
            </button>
          </form>
          <form
            action={assignCampaignAgentAction}
            className="space-y-3 rounded-2xl border bg-white p-5"
          >
            <h2 className="font-bold">Assign agent</h2>
            <select className={`${field} w-full`} name="campaignId">
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className={`${field} w-full`} name="agentId">
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              className={`${field} w-full`}
              name="responsibility"
              placeholder="Responsibility"
              required
            />
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-white">
              Assign
            </button>
          </form>
          <form
            action={recordCampaignCostAction}
            className="space-y-3 rounded-2xl border bg-white p-5"
          >
            <h2 className="font-bold">Record attributable cost</h2>
            <select className={`${field} w-full`} name="campaignId">
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className={`${field} w-full`} name="type">
              {[
                "RESEARCH",
                "OUTREACH",
                "DATA",
                "COMMUNICATION",
                "DILIGENCE",
                "LEGAL",
                "OTHER",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <input
              className={`${field} w-full`}
              name="amount"
              placeholder="Amount"
              required
            />
            <input
              className={`${field} w-full`}
              name="incurredAt"
              type="datetime-local"
              required
            />
            <input
              className={`${field} w-full`}
              name="sourceUrl"
              type="url"
              placeholder="Evidence URL"
              required
            />
            <input
              className={`${field} w-full`}
              name="description"
              placeholder="Description"
              required
            />
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-white">
              Record cost
            </button>
          </form>
          <form
            action={createCampaignGoalAction}
            className="space-y-3 rounded-2xl border bg-white p-5"
          >
            <h2 className="font-bold">Version campaign goals</h2>
            <select className={`${field} w-full`} name="campaignId">
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {[
                "discoveredTarget",
                "researchedTarget",
                "sellerContactTarget",
                "offerTarget",
                "contractTarget",
                "closeTarget",
              ].map((v) => (
                <input className={field} key={v} name={v} placeholder={v} />
              ))}
            </div>
            <input
              className={`${field} w-full`}
              name="realizedProfitTarget"
              placeholder="Realized profit target"
            />
            <input
              className={`${field} w-full`}
              name="effectiveAt"
              type="datetime-local"
              required
            />
            <input
              className={`${field} w-full`}
              name="expiresAt"
              type="datetime-local"
            />
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-white">
              Save goals
            </button>
          </form>
        </section>
      </div>
    </WorkspaceShell>
  );
}
