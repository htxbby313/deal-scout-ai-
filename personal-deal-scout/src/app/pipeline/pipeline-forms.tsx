"use client";

import { useActionState } from "react";
import {
  advanceStageAction,
  activateStagePolicyAction,
  confirmBuyerCoverageAction,
  createBuyerDemandAction,
  createCampaignAction,
  createStagePolicyAction,
  recordBuyerPriceAction,
  recordGateAction,
  type PipelineActionState,
} from "@/app/pipeline-actions";

const initial: PipelineActionState = { status: "idle", message: "" };
const Result = ({ state }: { state: PipelineActionState }) =>
  state.message ? (
    <p
      className={
        state.status === "error"
          ? "text-sm text-red-700"
          : "text-sm text-emerald-700"
      }
    >
      {state.message}
    </p>
  ) : null;
const field = "rounded-lg border px-3 py-2 text-sm";

function ActionForm({
  action,
  title,
  children,
}: {
  action: typeof createBuyerDemandAction;
  title: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm"
    >
      <h2 className="font-bold">{title}</h2>
      {children}
      <button
        className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Saving changes…" : "Save changes"}
      </button>
      <Result state={state} />
    </form>
  );
}

export function PipelineForms({
  funnels,
  developers,
  buyerDemand,
  stagePolicies,
}: {
  funnels: { id: string; property: string }[];
  developers: { id: string; name: string }[];
  buyerDemand: {
    id: string;
    developerId: string;
    developer: string;
    version: number;
  }[];
  stagePolicies: { id: string; stage: string; version: number; active: boolean }[];
}) {
  return (
    <section className="mt-6 grid gap-6 xl:grid-cols-2">
      <ActionForm action={createStagePolicyAction} title="Create stage policy version">
        <select className={`${field} w-full`} name="stage" required>{["DISCOVERED","RESEARCHABLE","BUYER_FIT","OUTREACH_READY","SELLER_ENGAGED","UNDERWRITING_READY","OFFER_READY","CONTRACTED","DISPOSITION_READY","CLOSED","DISQUALIFIED","NURTURE","ARCHIVED"].map((stage)=><option key={stage}>{stage}</option>)}</select>
        <input className={`${field} w-full`} name="reviewIntervalHours" type="number" min="1" placeholder="Review interval hours" required />
        <select className={`${field} w-full`} name="expiryAction" required>{["REFRESH_RESEARCH","MANUAL_VERIFICATION","NURTURE","DISQUALIFY","ARCHIVE"].map((action)=><option key={action}>{action}</option>)}</select>
        <input className={`${field} w-full`} name="requiredGateTypes" placeholder="Gate types, comma separated" />
        <textarea className={`${field} w-full`} name="entryCriteria" placeholder='Entry criteria JSON: [{"code":"fresh_research","description":"Current sourced research"}]' required />
        <textarea className={`${field} w-full`} name="exitCriteria" placeholder='Exit criteria JSON: [{"code":"owner_review","description":"Owner reviewed"}]' required />
        <input className={`${field} w-full`} name="highValueThreshold" placeholder="High-value threshold" />
        <input className={`${field} w-full`} name="effectiveAt" type="datetime-local" /><input className={`${field} w-full`} name="expiresAt" type="datetime-local" />
        <textarea className={`${field} w-full`} name="reason" placeholder="Version rationale" required />
      </ActionForm>
      <ActionForm action={activateStagePolicyAction} title="Activate stage policy">
        <select className={`${field} w-full`} name="policyId" required><option value="">Inactive policy version</option>{stagePolicies.filter((policy)=>!policy.active).map((policy)=><option key={policy.id} value={policy.id}>{policy.stage} · v{policy.version}</option>)}</select>
        <textarea className={`${field} w-full`} name="reason" placeholder="Owner activation reason" required />
      </ActionForm>
      <ActionForm
        action={createBuyerDemandAction}
        title="Record complete buyer demand"
      >
        <select className={`${field} w-full`} name="developerId" required>
          <option value="">Developer</option>
          {developers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input
          className={`${field} w-full`}
          name="states"
          placeholder="States"
          required
        />
        <input
          className={`${field} w-full`}
          name="counties"
          placeholder="Counties"
        />
        <input
          className={`${field} w-full`}
          name="zipCodes"
          placeholder="ZIP codes"
        />
        <input
          className={`${field} w-full`}
          name="excludedAreas"
          placeholder="Excluded areas"
        />
        <input
          className={`${field} w-full`}
          name="assetTypes"
          placeholder="Asset types"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={field}
            name="minPurchasePrice"
            placeholder="Min purchase price"
          />
          <input
            className={field}
            name="maxPurchasePrice"
            placeholder="Max purchase price"
          />
          <input
            className={field}
            name="minCompletedValue"
            placeholder="Min completed value"
          />
          <input
            className={field}
            name="maxCompletedValue"
            placeholder="Max completed value"
          />
          <input className={field} name="minAcres" placeholder="Min acres" />
          <input className={field} name="maxAcres" placeholder="Max acres" />
          <input
            className={field}
            name="minLotWidthFeet"
            placeholder="Min width ft"
          />
          <input
            className={field}
            name="minLotDepthFeet"
            placeholder="Min depth ft"
          />
          <input
            className={field}
            name="minFrontageFeet"
            placeholder="Min frontage ft"
          />
          <input
            className={field}
            name="maxAssignmentFee"
            placeholder="Max assignment fee"
          />
        </div>
        <input
          className={`${field} w-full`}
          name="accessPreferences"
          placeholder="Access preferences"
        />
        <input
          className={`${field} w-full`}
          name="utilityPreferences"
          placeholder="Utility preferences"
        />
        <input
          className={`${field} w-full`}
          name="zoningPreferences"
          placeholder="Zoning preferences"
        />
        <input
          className={`${field} w-full`}
          name="floodPreferences"
          placeholder="Flood preferences"
        />
        <input
          className={`${field} w-full`}
          name="entitlementPreferences"
          placeholder="Entitlement preferences"
        />
        <input
          className={`${field} w-full`}
          name="redevelopmentPreferences"
          placeholder="Demolition, renovation, infill, land, assemblage…"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={field}
            name="requiredClosingDays"
            placeholder="Closing days"
          />
          <input
            className={field}
            name="earnestMoneyExpectation"
            placeholder="Earnest money"
          />
        </div>
        <select className={`${field} w-full`} name="assignmentAcceptance">
          <option value="">Assignment acceptance unknown</option>
          <option>ACCEPTED</option>
          <option>REJECTED</option>
          <option>CONDITIONAL</option>
        </select>
        <select className={`${field} w-full`} name="doubleCloseAcceptance">
          <option value="">Double-close acceptance unknown</option>
          <option>ACCEPTED</option>
          <option>REJECTED</option>
          <option>CONDITIONAL</option>
        </select>
        <input
          className={`${field} w-full`}
          name="inspectionRequirements"
          placeholder="Inspection or feasibility requirements"
        />
        <input
          className={`${field} w-full`}
          name="decisionMakerName"
          placeholder="Verified decision maker"
        />
        <select className={`${field} w-full`} name="approvedChannel">
          <option value="">Approved channel unknown</option>
          {["EMAIL", "SMS", "PHONE", "MAIL", "INTERNAL"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <input
          className={`${field} w-full`}
          name="currentBuyingStatus"
          placeholder="Current buying status"
        />
        <input
          className={`${field} w-full`}
          name="criteriaConfirmedAt"
          type="datetime-local"
          required
        />
        <input
          className={`${field} w-full`}
          name="strategy"
          placeholder="Strategy"
        />
        <input
          className={`${field} w-full`}
          name="sourceUrl"
          type="url"
          placeholder="HTTPS evidence URL"
          required
        />
        <input
          className={`${field} w-full`}
          name="expiresAt"
          type="datetime-local"
          required
        />
        <textarea
          className={`${field} w-full`}
          name="notes"
          placeholder="Criteria notes"
        />
      </ActionForm>
      <ActionForm
        action={recordBuyerPriceAction}
        title="Record property-specific buyer pricing"
      >
        <select className={`${field} w-full`} name="demandVersionId" required>
          <option value="">Buyer demand version</option>
          {buyerDemand.map((d) => (
            <option key={d.id} value={d.id}>
              {d.developer} · v{d.version}
            </option>
          ))}
        </select>
        <select className={`${field} w-full`} name="developerId" required>
          <option value="">Buyer</option>
          {developers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select className={`${field} w-full`} name="funnelId" required>
          <option value="">Property opportunity</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.property}
            </option>
          ))}
        </select>
        <select className={`${field} w-full`} name="status">
          {["INDICATIVE", "CONDITIONAL", "DOCUMENTED", "COMMITTED"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <input
            className={field}
            name="low"
            placeholder="Low price"
            required
          />
          <input
            className={field}
            name="base"
            placeholder="Base price"
            required
          />
          <input
            className={field}
            name="high"
            placeholder="High price"
            required
          />
        </div>
        <input
          className={`${field} w-full`}
          name="sourceUrl"
          type="url"
          placeholder="Pricing evidence URL"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={field}
            name="observedAt"
            type="datetime-local"
            required
          />
          <input
            className={field}
            name="expiresAt"
            type="datetime-local"
            required
          />
        </div>
        <textarea
          className={`${field} w-full`}
          name="assumptions"
          placeholder="Pricing assumptions, comma separated"
          required
        />
      </ActionForm>
      <ActionForm
        action={confirmBuyerCoverageAction}
        title="Confirm primary or backup buyer coverage"
      >
        <select className={`${field} w-full`} name="demandVersionId" required>
          <option value="">Verified buyer demand version</option>
          {buyerDemand.map((d) => (
            <option key={d.id} value={d.id}>
              {d.developer} · v{d.version}
            </option>
          ))}
        </select>
        <select className={`${field} w-full`} name="funnelId" required>
          <option value="">Property opportunity</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.property}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select className={field} name="role">
            <option>PRIMARY</option>
            <option>BACKUP</option>
          </select>
          <input
            className={field}
            name="matchScore"
            type="number"
            min="0"
            max="100"
            placeholder="Match score"
            required
          />
        </div>
        <textarea
          className={`${field} w-full`}
          name="reasons"
          placeholder="Evidence-backed reasons, comma separated"
          required
        />
        <input
          className={`${field} w-full`}
          name="expiresAt"
          type="datetime-local"
          required
        />
        <p className="text-xs text-slate-500">
          Confirmation fails closed unless current verified demand, property
          pricing, proof of funds, eligible reliability, and communication
          permission all agree.
        </p>
      </ActionForm>
      <ActionForm
        action={createCampaignAction}
        title="Define a bounded operating campaign"
      >
        <input
          className={`${field} w-full`}
          name="name"
          placeholder="Campaign name"
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={field}
            name="state"
            maxLength={2}
            placeholder="State"
            required
          />
          <select className={field} name="type">
            <option value="SELLER_ACQUISITION">Seller acquisition</option>
            <option value="BUYER_DISPOSITION">Buyer disposition</option>
          </select>
        </div>
        <input
          className={`${field} w-full`}
          name="counties"
          placeholder="Counties, comma separated"
        />
        <input
          className={`${field} w-full`}
          name="cities"
          placeholder="Cities, comma separated"
        />
        <input
          className={`${field} w-full`}
          name="zipCodes"
          placeholder="ZIP codes, comma separated"
        />
        <input
          className={`${field} w-full`}
          name="neighborhoods"
          placeholder="Neighborhoods, comma separated"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            className={field}
            name="radiusCenterLatitude"
            type="number"
            step="any"
            placeholder="Radius latitude"
          />
          <input
            className={field}
            name="radiusCenterLongitude"
            type="number"
            step="any"
            placeholder="Radius longitude"
          />
          <input
            className={field}
            name="radiusMiles"
            type="number"
            min="0"
            step="any"
            placeholder="Radius miles"
          />
        </div>
        <textarea
          className={`${field} w-full`}
          name="mapPolygon"
          placeholder="Map polygon GeoJSON (optional)"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={field}
            name="includedPropertyTypes"
            placeholder="Included property types"
          />
          <input
            className={field}
            name="excludedPropertyTypes"
            placeholder="Excluded property types"
          />
        </div>
        <input
          className={`${field} w-full`}
          name="acquisitionStrategy"
          placeholder="Acquisition strategy"
        />
        <textarea
          className={`${field} w-full`}
          name="developmentFilters"
          placeholder="Development filters JSON"
        />
        <textarea
          className={`${field} w-full`}
          name="priceFilters"
          placeholder="Price filters JSON"
        />
        <input
          className={`${field} w-full`}
          name="targetBuyerGroup"
          placeholder="Target buyer group"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={field}
            name="minimumRequiredProfit"
            placeholder="Minimum required profit"
          />
          <input
            className={field}
            name="maximumEarnestMoney"
            placeholder="Maximum earnest money"
          />
          <input
            className={field}
            name="maximumResearchCost"
            placeholder="Maximum research cost"
          />
          <input
            className={field}
            name="maximumOutreachCost"
            placeholder="Maximum outreach cost"
          />
          <input
            className={field}
            name="evidenceFreshnessHours"
            type="number"
            min="1"
            placeholder="Evidence freshness hours"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            className={field}
            name="startsAt"
            type="datetime-local"
            required
          />
          <input
            className={field}
            name="endsAt"
            type="datetime-local"
            required
          />
        </div>
        <textarea
          className={`${field} w-full`}
          name="audienceCriteria"
          placeholder="Audience criteria"
          required
        />
        <textarea
          className={`${field} w-full`}
          name="sourceRequirements"
          placeholder="Required public evidence"
          required
        />
        <p className="text-xs text-slate-500">
          Saved as draft. Outbound remains disabled until separate owner and
          compliance approval.
        </p>
      </ActionForm>
      <ActionForm action={recordGateAction} title="Record an evidence gate">
        <select className={`${field} w-full`} name="funnelId" required>
          <option value="">Opportunity</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.property}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select className={field} name="type">
            {[
              "PROPERTY_EVIDENCE",
              "SELLER_CONTACT",
              "UNDERWRITING",
              "COMPLIANCE",
              "CONTRACT",
              "BUYER_COVERAGE",
              "DISPOSITION",
              "CLOSING",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select className={field} name="status">
            {["PENDING", "SATISFIED", "FAILED", "EXPIRED", "WAIVED"].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </div>
        <input
          className={`${field} w-full`}
          name="sourceUrl"
          type="url"
          placeholder="HTTPS evidence URL"
        />
        <input
          className={`${field} w-full`}
          name="expiresAt"
          type="datetime-local"
        />
        <textarea
          className={`${field} w-full`}
          name="evidence"
          placeholder="Evidence notes"
          required
        />
      </ActionForm>
      <ActionForm
        action={advanceStageAction}
        title="Advance or route an opportunity"
      >
        <select className={`${field} w-full`} name="funnelId" required>
          <option value="">Opportunity</option>
          {funnels.map((f) => (
            <option key={f.id} value={f.id}>
              {f.property}
            </option>
          ))}
        </select>
        <select className={`${field} w-full`} name="nextStage">
          {[
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
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <textarea
          className={`${field} w-full`}
          name="reason"
          placeholder="Decision reason"
          required
        />
        <textarea className={`${field} w-full`} name="entryEvidence" placeholder='Entry evidence JSON: [{"code":"buyer_coverage","description":"Primary and backup verified","satisfied":true,"sourceUrl":"https://...","observedAt":"2026-08-19"}]' required />
        <textarea className={`${field} w-full`} name="exitEvidence" placeholder="Exit evidence JSON using the active policy criterion codes" required />
        <label className="flex items-center gap-2 text-sm"><input name="terminalOwnerApproval" type="checkbox" value="approved"/>Owner approval evidence for terminal routing</label>
      </ActionForm>
    </section>
  );
}
