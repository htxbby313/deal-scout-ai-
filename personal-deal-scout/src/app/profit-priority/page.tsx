import { WorkspaceShell } from "@/app/workspace-shell";
import {
  activateConfigurationAction,
  createConfigurationAction,
} from "@/app/profit-priority/actions";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
const field = "rounded-lg border px-3 py-2 text-sm";
export default async function ProfitPriorityPage() {
  await requireOwner();
  const configs = await getPrisma().profitPriorityScoreConfiguration.findMany({
    orderBy: { version: "desc" },
  });
  return (
    <WorkspaceShell active="pipeline">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-3xl font-bold">
          Profit-adjusted acquisition priority
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Owner-controlled, versioned weights. Scores rank research attention
          only; they are not buyer interest, seller acceptance, legal approval,
          contracted fees, or guaranteed profit.
        </p>
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <form
            action={createConfigurationAction}
            className="space-y-3 rounded-2xl border bg-white p-5"
          >
            <h2 className="font-bold">Create draft configuration</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                "projectedProfit",
                "probability",
                "sellerFit",
                "evidence",
                "buyerCoverage",
                "velocity",
                "riskPenalty",
              ].map((name) => (
                <input
                  key={name}
                  className={field}
                  name={name}
                  type="number"
                  min="0"
                  placeholder={`${name} bps`}
                  required
                />
              ))}
            </div>
            <textarea
              className={`${field} w-full`}
              name="reason"
              placeholder="Why these weights are appropriate"
              required
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
              Save draft
            </button>
          </form>
          <form
            action={activateConfigurationAction}
            className="space-y-3 rounded-2xl border bg-white p-5"
          >
            <h2 className="font-bold">Activate reviewed configuration</h2>
            <select
              className={`${field} w-full`}
              name="configurationId"
              required
            >
              <option value="">Draft version</option>
              {configs
                .filter((c) => c.status === "DRAFT")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    v{c.version} · {c.reason}
                  </option>
                ))}
            </select>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-white">
              Activate and retire prior version
            </button>
          </form>
        </section>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">Configuration history</h2>
          {configs.map((c) => (
            <p className="mt-2 text-sm" key={c.id}>
              v{c.version} · {c.status} · {c.reason}
            </p>
          ))}
        </section>
      </div>
    </WorkspaceShell>
  );
}
