import { WorkspaceShell } from "@/app/workspace-shell";
import {
  activateReliabilityConfigAction,
  calculateReliabilityAction,
  createReliabilityConfigAction,
  recordCapacityAction,
  recordIssueAction,
  recordPermissionAction,
  recordReliabilityEvidenceAction,
} from "@/app/buyer-evidence/actions";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
const f = "rounded-lg border px-3 py-2 text-sm";
const buyers = (items: { id: string; companyName: string }[]) =>
  items.map((x) => (
    <option key={x.id} value={x.id}>
      {x.companyName}
    </option>
  ));
export default async function Page() {
  await requireOwner();
  const db = getPrisma();
  const [developers, demand, evidence, configs] = await Promise.all([
    db.developer.findMany({ orderBy: { companyName: "asc" } }),
    db.buyerDemandVersion.findMany({
      include: { developer: true },
      orderBy: { createdAt: "desc" },
    }),
    db.buyerReliabilityEvidence.findMany({
      include: { developer: true },
      orderBy: { createdAt: "desc" },
    }),
    db.buyerReliabilityScoreConfiguration.findMany({
      orderBy: { version: "desc" },
    }),
  ]);
  return (
    <WorkspaceShell active="pipeline">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-3xl font-bold">Buyer evidence and reliability</h1>
        <p className="mt-2 text-sm text-slate-600">
          Owner-entered evidence stays versioned and expiring. Reliability is
          derived from persisted records and never proves willingness to buy.
        </p>
        <section className="mt-6 grid gap-5 md:grid-cols-2">
          <form
            action={recordReliabilityEvidenceAction}
            className="space-y-2 rounded-2xl border p-5"
          >
            <b>Sourced reliability observations</b>
            <select className={`${f} w-full`} name="developerId">
              {buyers(developers)}
            </select>
            <div className="grid grid-cols-3 gap-2">
              {[
                "completedClosings",
                "failedClosings",
                "retrades",
                "responsesMeasured",
                "unresolvedIssues",
              ].map((x) => (
                <input
                  className={f}
                  key={x}
                  name={x}
                  type="number"
                  min="0"
                  placeholder={x}
                  required
                />
              ))}
            </div>
            <input
              className={`${f} w-full`}
              name="averageResponseHours"
              type="number"
              min="0"
              step="any"
              placeholder="Average response hours"
            />
            <input
              className={`${f} w-full`}
              name="averageCloseDays"
              type="number"
              min="0"
              placeholder="Average close days"
            />
            <input
              className={`${f} w-full`}
              name="sourceUrl"
              type="url"
              placeholder="HTTPS source evidence"
              required
            />
            <input
              className={`${f} w-full`}
              name="expiresAt"
              type="datetime-local"
              required
            />
            <label className="block text-sm">
              <input name="verified" type="checkbox" /> Owner reviewed source
              and observations
            </label>
            <button className="rounded bg-slate-950 px-3 py-2 text-white">
              Save evidence version
            </button>
          </form>{" "}
          <form
            action={recordCapacityAction}
            className="space-y-2 rounded-2xl border p-5"
          >
            <b>Proof of funds</b>
            <select className={`${f} w-full`} name="developerId">
              {buyers(developers)}
            </select>
            <input
              className={`${f} w-full`}
              name="amount"
              placeholder="Amount"
            />
            <input
              className={`${f} w-full`}
              name="sourceUrl"
              type="url"
              placeholder="HTTPS evidence URL"
              required
            />
            <input
              className={`${f} w-full`}
              name="artifactHash"
              placeholder="Optional SHA-256 artifact hash"
            />
            <input
              className={`${f} w-full`}
              name="observedAt"
              type="datetime-local"
              required
            />
            <input
              className={`${f} w-full`}
              name="expiresAt"
              type="datetime-local"
              required
            />
            <label className="block text-sm">
              <input name="verified" type="checkbox" /> Owner reviewed and
              verified
            </label>
            <button className="rounded bg-slate-950 px-3 py-2 text-white">
              Save POF
            </button>
          </form>
          <form
            action={recordPermissionAction}
            className="space-y-2 rounded-2xl border p-5"
          >
            <b>Communication permission</b>
            <select className={`${f} w-full`} name="developerId">
              {buyers(developers)}
            </select>
            <select className={`${f} w-full`} name="channel">
              {["EMAIL", "SMS", "PHONE", "MAIL", "INTERNAL"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <select className={`${f} w-full`} name="status">
              {["UNKNOWN", "GRANTED", "DENIED", "REVOKED", "EXPIRED"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
            <input
              className={`${f} w-full`}
              name="sourceUrl"
              type="url"
              placeholder="Evidence URL"
            />
            <input
              className={`${f} w-full`}
              name="capturedAt"
              type="datetime-local"
              required
            />
            <input
              className={`${f} w-full`}
              name="expiresAt"
              type="datetime-local"
            />
            <button className="rounded bg-slate-950 px-3 py-2 text-white">
              Save permission
            </button>
          </form>
          <form
            action={recordIssueAction}
            className="space-y-2 rounded-2xl border p-5"
          >
            <b>Performance issue</b>
            <select className={`${f} w-full`} name="developerId">
              {buyers(developers)}
            </select>
            <input
              className={`${f} w-full`}
              name="type"
              placeholder="Issue type"
              required
            />
            <select className={`${f} w-full`} name="status">
              {["OPEN", "DISPUTED", "RESOLVED", "DISMISSED"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
            <input
              className={`${f} w-full`}
              name="occurredAt"
              type="datetime-local"
              required
            />
            <textarea className={`${f} w-full`} name="description" required />
            <input
              className={`${f} w-full`}
              name="sourceUrl"
              type="url"
              required
            />
            <input
              className={`${f} w-full`}
              name="resolution"
              placeholder="Resolution"
            />
            <input
              className={`${f} w-full`}
              name="resolvedAt"
              type="datetime-local"
            />
            <button className="rounded bg-slate-950 px-3 py-2 text-white">
              Save issue
            </button>
          </form>
          <form
            action={createReliabilityConfigAction}
            className="space-y-2 rounded-2xl border p-5"
          >
            <b>Draft reliability weights</b>
            <div className="grid grid-cols-3 gap-2">
              {[
                "financialCapacity",
                "marketActivity",
                "criteriaSpecificity",
                "responseTime",
                "closingRate",
                "pofFreshness",
                "retradePenalty",
                "failedClosingPenalty",
                "unresolvedIssuePenalty",
              ].map((x) => (
                <input
                  className={f}
                  key={x}
                  name={x}
                  type="number"
                  min="0"
                  placeholder={`${x} bps`}
                  required
                />
              ))}
            </div>
            <textarea className={`${f} w-full`} name="reason" required />
            <input
              className={`${f} w-full`}
              name="effectiveAt"
              type="datetime-local"
              required
            />
            <input
              className={`${f} w-full`}
              name="expiresAt"
              type="datetime-local"
            />
            <button className="rounded bg-slate-950 px-3 py-2 text-white">
              Save draft
            </button>
          </form>
          <form
            action={activateReliabilityConfigAction}
            className="space-y-2 rounded-2xl border p-5"
          >
            <b>Activate reliability configuration</b>
            <select className={`${f} w-full`} name="configurationId">
              {configs
                .filter((x) => x.status === "DRAFT")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    v{x.version} · {x.reason}
                  </option>
                ))}
            </select>
            <button className="rounded bg-slate-950 px-3 py-2 text-white">
              Activate
            </button>
          </form>
          <form
            action={calculateReliabilityAction}
            className="space-y-2 rounded-2xl border p-5"
          >
            <b>Calculate from persisted evidence</b>
            <select className={`${f} w-full`} name="developerId">
              {buyers(developers)}
            </select>
            <select className={`${f} w-full`} name="demandVersionId">
              {demand.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.developer.companyName} demand v{x.version}
                </option>
              ))}
            </select>
            <select className={`${f} w-full`} name="reliabilityEvidenceId">
              {evidence.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.developer.companyName} evidence v{x.version}
                </option>
              ))}
            </select>
            <select className={`${f} w-full`} name="configurationId">
              {configs
                .filter((x) => x.status === "ACTIVE")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    active v{x.version}
                  </option>
                ))}
            </select>
            <input
              className={`${f} w-full`}
              name="expiresAt"
              type="datetime-local"
              required
            />
            <button className="rounded bg-slate-950 px-3 py-2 text-white">
              Calculate stored score
            </button>
          </form>
        </section>
      </div>
    </WorkspaceShell>
  );
}
