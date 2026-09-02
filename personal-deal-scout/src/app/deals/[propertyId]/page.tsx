import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/app/workspace-shell";
import {
  recordComparableSaleAction,
  registerZillowReferenceAction,
} from "@/app/deal-desk-actions";
import { DealAnalysisCalculator } from "@/app/deals/[propertyId]/deal-analysis-calculator";
import { requireOwner } from "@/lib/auth";
import { evaluateComparableSales } from "@/lib/comp-engine";
import { getDeal } from "@/lib/deal";
import {
  acquisitionStageLabel,
  confidenceBand,
  offerVerdict,
  sellerConversationHref,
} from "@/lib/deal-cockpit";
import { evaluatePropertyPresentation } from "@/lib/property-presentation-policy";
import { sellerNextAction } from "@/lib/seller-crm-domain";

export const dynamic = "force-dynamic";
const dollars = (cents?: bigint | null) =>
  cents == null
    ? "Insufficient verified data"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(cents / BigInt(100));
const price = (value?: { toString(): string } | null) =>
  value == null
    ? "Unknown"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(value.toString()));

export default async function DealDeskPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  await requireOwner();
  const { propertyId } = await params;
  const deal = await getDeal(propertyId);
  if (!deal) notFound();
  const { property, transaction, projection, gates, sellerEngagements, funnel } =
    deal;
  const engagement = sellerEngagements[0];
  const lastConversation = engagement?.conversations[0];
  const verified = property.researchFindings.filter(
    (finding) => finding.status === "VERIFIED",
  );
  const conflicts = property.researchFindings.filter(
    (finding) => finding.status === "CONFLICT",
  );
  const presentation = evaluatePropertyPresentation(transaction ?? null);
  const sellerAction = engagement
    ? sellerNextAction({
        controlStatus: transaction?.controlStatus ?? "ON_HOLD",
        consentStatus: engagement.consents[0]?.status,
        conversationCount: engagement._count.conversations,
        sellerFactCount: engagement._count.sellerFacts,
        engagementStatus: engagement.status,
        followUps: engagement.followUps,
        latestOfferStatus: engagement.offerHistory[0]?.status,
      })
    : null;
  const nextAction =
    transaction?.controlStatus === "STOPPED"
      ? "Stopped by owner"
      : conflicts.length
        ? "Resolve conflicting evidence"
        : !transaction
          ? "Build seller relationship and verify deal terms"
          : sellerAction?.[0] ??
            (!presentation.allowed
              ? "Complete contract and disposition controls"
              : "Review approved buyer presentation");
  const confidence = verified.length
    ? Math.round(
        verified.reduce((sum, item) => sum + item.confidence, 0) /
          verified.length,
      )
    : null;
  const verdict = offerVerdict({
    conflictCount: conflicts.length,
    sellerSafeMaximumCents: projection?.sellerSafeMaximumCents,
    projectedSpreadCents: projection?.feeBaseCents,
  });
  const sellerHref = sellerConversationHref({
    engagementId: engagement?.id,
    address: property.address,
  });
  const topMatch = property.matches[0];
  const stageLabel = acquisitionStageLabel(
    funnel?.stage ?? property.acquisitionFunnels[0]?.stage,
    {
      matchCount: property.matches.length,
    },
  );
  const evidenceBand = confidenceBand(confidence, verified.length);
  const comps = evaluateComparableSales(
    {
      propertyType: property.propertyType,
      yearBuilt: property.yearBuilt ? Number(property.yearBuilt) : null,
    },
    property.comparableSales.map((item) => ({
      ...item,
      distanceMiles: Number(item.distanceMiles),
      bedrooms: item.bedrooms ? Number(item.bedrooms) : null,
      bathrooms: item.bathrooms ? Number(item.bathrooms) : null,
    })),
  );
  return (
    <WorkspaceShell active="pipeline">
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <Link
          className="text-sm font-semibold text-blue-700"
          href="/properties"
        >
          ← Opportunities
        </Link>
        <header className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                Deal Box
              </p>
              <h1 className="mt-1 text-3xl font-bold">{property.address}</h1>
              <p className="mt-2 text-slate-600">
                {property.city}, {property.state} {property.zipCode}
              </p>
            </div>
            <span className="w-fit rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
              {stageLabel}
            </span>
          </div>
          <p className="mt-5 text-xl font-bold">{verdict}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary
              label="Seller-safe maximum"
              value={dollars(projection?.sellerSafeMaximumCents)}
            />
            <Summary
              label="Projected spread"
              value={dollars(projection?.feeBaseCents)}
            />
            <Summary
              label="Evidence"
              value={evidenceBand}
            />
            <Summary
              label="Likely buyers"
              value={
                topMatch
                  ? `${property.matches.length} · ${topMatch.developer.companyName}`
                  : "None matched"
              }
            />
          </div>
          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase text-blue-700">
              Recommended next action
            </p>
            <p className="mt-1 font-bold">{nextAction}</p>
          </div>
          <article className="mt-4 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase text-slate-500">Seller</p>
            <p className="mt-1 font-bold">
              {engagement?.recipientLabel ||
                property.contactName ||
                property.ownerName ||
                "Seller unknown"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {property.contactPhone
                ? `Phone ${property.contactPhone}`
                : "No phone on file"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Last contact:{" "}
              {lastConversation
                ? lastConversation.occurredAt.toLocaleString()
                : "None recorded"}
            </p>
            {engagement ? (
              <Link
                className="mt-3 inline-block text-sm font-bold text-blue-700"
                href={sellerHref}
              >
                {nextAction.startsWith("Build seller relationship")
                  ? "Open seller conversation"
                  : `Seller next step: ${sellerAction?.[0] ?? "Open conversation"}`}
              </Link>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                No seller engagement on this deal.{" "}
                <Link className="font-bold text-blue-700" href={sellerHref}>
                  Open Contacts with this property
                </Link>
              </p>
            )}
          </article>
          <Link
            className="mt-4 inline-block rounded-xl border border-blue-700 px-4 py-2 text-sm font-bold text-blue-700"
            href={`/deals/${property.id}/package`}
          >
            Generate Deal Package
          </Link>
        </header>
        <nav
          aria-label="Deal Desk sections"
          className="mt-5 flex gap-2 overflow-x-auto pb-2"
        >
          {[
            ["overview", "Overview"],
            ["comps", "Comps"],
            ["numbers", "Numbers"],
            ["buyers", "Buyer Match"],
            ["evidence", "Evidence"],
          ].map(([id, label]) => (
            <a
              className="whitespace-nowrap rounded-full border bg-white px-4 py-2 text-sm font-bold"
              href={`#${id}`}
              key={id}
            >
              {label}
            </a>
          ))}
        </nav>
        <section className="mt-4 grid gap-5 lg:grid-cols-2" id="overview">
          <Panel title="Overview">
            <Rows
              rows={[
                [
                  "Owner/contact",
                  property.contactName || property.ownerName || "Unknown",
                ],
                ["Phone", property.contactPhone || "Missing"],
                ["Status", property.opportunityStatus.replaceAll("_", " ")],
                ["Verified findings", String(verified.length)],
                ["Open conflicts", String(conflicts.length)],
              ]}
            />
          </Panel>
          <Panel title="Control status">
            <Rows
              rows={[
                [
                  "Transaction",
                  transaction?.status.replaceAll("_", " ") ?? "Not created",
                ],
                [
                  "Owner control",
                  transaction?.controlStatus.replaceAll("_", " ") ??
                    "Not active",
                ],
                [
                  "Property presentation",
                  presentation.allowed
                    ? "Allowed by current controls"
                    : "Blocked",
                ],
                [
                  "Current gates",
                  gates
                    .map((gate) => `${gate.type}: ${gate.status}`)
                    .join(" · ") || "No gates recorded",
                ],
              ]}
            />
            {!presentation.allowed ? (
              <p className="mt-3 text-xs text-amber-800">
                Missing: {presentation.blockers.join(", ").replaceAll("_", " ")}
                . Internal matching may continue; no property offer is
                authorized.
              </p>
            ) : null}
          </Panel>
        </section>
        <section className="mt-5" id="comps">
          <Panel title="Comps">
            <p className="text-sm text-slate-600">
              Comparable evidence must include a source and observation date. No
              appraisal or guaranteed value is generated from incomplete
              records.
            </p>
            <Rows
              rows={[
                ["Selected comps", String(comps.selected.length)],
                ["Quality score", `${comps.qualityScore}/100`],
                [
                  "Estimated value range",
                  comps.valueLowCents
                    ? `${dollars(comps.valueLowCents)} – ${dollars(comps.valueHighCents)}`
                    : "Insufficient verified data",
                ],
                ["Confidence", comps.confidence],
              ]}
            />
            <p className="mt-3 text-xs text-slate-500">{comps.disclaimer}</p>
            {comps.scored.map((item) => (
              <article
                className={`mt-3 rounded-xl border p-4 ${item.excluded ? "bg-slate-50" : "bg-emerald-50"}`}
                key={item.id}
              >
                <b>{item.address}</b>
                <p className="mt-1 text-sm">
                  {dollars(item.soldPriceCents)} · {item.score}/100
                </p>
                <p className="mt-2 text-xs">{item.reasons.join(" ")}</p>
                <a
                  className="mt-2 block text-xs font-bold text-blue-700 underline"
                  href={item.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open source
                </a>
              </article>
            ))}
            <details className="mt-4 rounded-xl border p-4">
              <summary className="cursor-pointer font-bold">
                Add sourced comparable sale
              </summary>
              <form
                action={recordComparableSaleAction}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <input name="propertyId" type="hidden" value={property.id} />
                {[
                  ["address", "Comparable address"],
                  ["distanceMiles", "Distance in miles"],
                  ["soldPrice", "Sold price"],
                  ["soldDate", "Sold date"],
                  ["propertyType", "Property type"],
                  ["squareFeet", "Square feet"],
                  ["lotSquareFeet", "Lot square feet"],
                  ["yearBuilt", "Year built"],
                  ["condition", "Condition notes"],
                  ["sourceUrl", "Public-record source URL"],
                  ["observedAt", "Date source checked"],
                  ["confidence", "Confidence 1–100"],
                ].map(([name, label]) => (
                  <label
                    className="grid gap-1 text-sm font-semibold"
                    key={name}
                  >
                    {label}
                    <input
                      className="rounded-lg border px-3 py-2 font-normal"
                      name={name}
                      required={[
                        "address",
                        "distanceMiles",
                        "soldPrice",
                        "soldDate",
                        "sourceUrl",
                        "observedAt",
                        "confidence",
                      ].includes(name)}
                      type={
                        ["soldDate", "observedAt"].includes(name)
                          ? "date"
                          : [
                                "distanceMiles",
                                "soldPrice",
                                "squareFeet",
                                "lotSquareFeet",
                                "yearBuilt",
                                "confidence",
                              ].includes(name)
                            ? "number"
                            : "text"
                      }
                    />
                  </label>
                ))}
                <button className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white sm:col-span-2">
                  Save comparable evidence
                </button>
              </form>
            </details>
          </Panel>
        </section>
        <section className="mt-5" id="numbers">
          <Panel title="Numbers">
            <Rows
              rows={[
                [
                  "Buyer price range",
                  projection
                    ? `${dollars(projection.buyerPriceLowCents)} – ${dollars(projection.buyerPriceHighCents)}`
                    : "Insufficient verified data",
                ],
                [
                  "Projected fee range",
                  projection
                    ? `${dollars(projection.feeLowCents)} – ${dollars(projection.feeHighCents)}`
                    : "Insufficient verified data",
                ],
                [
                  "Probability-weighted value",
                  dollars(projection?.probabilityWeightedCents),
                ],
                [
                  "Earnest money at risk",
                  dollars(projection?.earnestMoneyAtRiskCents),
                ],
              ]}
            />
            <p className="mt-3 text-xs text-slate-500">
              Projections are not guaranteed revenue. Closed profit requires
              settlement evidence.
            </p>
            <details className="mt-4 rounded-xl border p-4">
              <summary className="cursor-pointer font-bold">
                Compare Wholesale, Flip, BRRRR, and Rental
              </summary>
              <div className="mt-4">
                <DealAnalysisCalculator
                  defaultAcquisitionCents={
                    projection?.sellerContractPriceCents.toString() ?? null
                  }
                  verifiedExitBaseCents={
                    (
                      comps.valueBaseCents ?? projection?.buyerPriceBaseCents
                    )?.toString() ?? null
                  }
                  verifiedExitHighCents={
                    (
                      comps.valueHighCents ?? projection?.buyerPriceHighCents
                    )?.toString() ?? null
                  }
                  verifiedExitLowCents={
                    (
                      comps.valueLowCents ?? projection?.buyerPriceLowCents
                    )?.toString() ?? null
                  }
                />
              </div>
            </details>
          </Panel>
        </section>
        <section className="mt-5" id="buyers">
          <Panel title="Buyer Match">
            <p className="text-sm text-slate-600">
              Up to five genuine buy-box matches. Matching is internal until the
              property-presentation controls above are satisfied.
            </p>
            <div className="mt-4 grid gap-3">
              {property.matches.map(({ developer, score, reasons }, index) => (
                <article className="rounded-xl border p-4" key={developer.id}>
                  <div className="flex justify-between gap-3">
                    <b>
                      #{index + 1} {developer.companyName}
                    </b>
                    <span className="text-sm font-bold text-blue-700">
                      {score}/100
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {reasons.join(" ")}
                  </p>
                </article>
              ))}
              {!property.matches.length ? (
                <Empty text="No developer currently satisfies the recorded buy box." />
              ) : null}
            </div>
          </Panel>
        </section>
        <section className="mt-5" id="evidence">
          <Panel title="Evidence">
            <div className="grid gap-3 md:grid-cols-2">
              {property.researchFindings.map((item) => (
                <Evidence key={item.id} item={item} />
              ))}
              {!property.researchFindings.length ? (
                <Empty text="No research evidence has been recorded yet." />
              ) : null}
            </div>
            <details className="mt-5 rounded-xl border p-4">
              <summary className="cursor-pointer font-bold">
                Add Zillow discovery reference
              </summary>
              <p className="mt-2 text-xs text-slate-500">
                The link and your observation are recorded without fetching or
                scraping the Zillow page. Official research remains
                authoritative.
              </p>
              <form
                action={registerZillowReferenceAction}
                className="mt-4 grid gap-3"
              >
                <input name="propertyId" type="hidden" value={property.id} />
                <input
                  className="rounded-lg border px-3 py-2"
                  name="url"
                  placeholder="Direct Zillow property URL"
                  required
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  name="observedAddress"
                  placeholder="Address observed"
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  name="observedAskingPrice"
                  placeholder="Asking price observed"
                  type="number"
                />
                <input
                  className="rounded-lg border px-3 py-2"
                  name="observedAvailability"
                  placeholder="Availability observed"
                />
                <textarea
                  className="rounded-lg border px-3 py-2"
                  name="observationNotes"
                  placeholder="Observation notes"
                />
                <button className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white">
                  Record reference and refresh official research
                </button>
              </form>
            </details>
            {property.discoveryReferences.length ? (
              <div className="mt-5">
                <h3 className="font-bold">Source comparison</h3>
                {property.discoveryReferences.map((reference) => (
                  <article
                    className="mt-3 rounded-xl border p-4"
                    key={reference.id}
                  >
                    <a
                      className="font-bold text-blue-700 underline"
                      href={reference.normalizedUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open Zillow reference
                    </a>
                    <p className="mt-2 text-sm">
                      Observed price:{" "}
                      {reference.observedAskingPrice
                        ? price(reference.observedAskingPrice)
                        : "Not recorded"}{" "}
                      · Official known price: {price(property.estimatedValue)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {reference.verificationStatus.replaceAll("_", " ")} ·
                      Zillow is not the system of record.
                    </p>
                    {reference.conflictSummary ? (
                      <p className="mt-2 text-sm text-amber-800">
                        Source conflict requires review.
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </Panel>
        </section>
      </div>
    </WorkspaceShell>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}
function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}
function Rows({ rows }: { rows: string[][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="mt-4 rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}
function Evidence({
  item,
}: {
  item: {
    id: string;
    label: string;
    value: string | null;
    status: string;
    sourceUrl: string | null;
    observedAt: Date;
    confidence: number;
  };
}) {
  return (
    <article className="mt-3 rounded-xl border p-4">
      <div className="flex justify-between gap-3">
        <b className="text-sm">{item.label}</b>
        <span className="text-xs font-bold">
          {item.status.replaceAll("_", " ")}
        </span>
      </div>
      {item.value ? <p className="mt-2 text-sm">{item.value}</p> : null}
      <p className="mt-2 text-xs text-slate-500">
        Observed {item.observedAt.toLocaleDateString()} · {item.confidence}%
        confidence
      </p>
      {item.sourceUrl ? (
        <a
          className="mt-2 block text-xs font-bold text-blue-700 underline"
          href={item.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open source
        </a>
      ) : null}
    </article>
  );
}
