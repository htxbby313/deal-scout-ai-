import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/app/workspace-shell";
import {
  recordComparableSaleAction,
  registerZillowReferenceAction,
} from "@/app/deal-desk-actions";
import { DealAnalysisCalculator } from "@/app/deals/[propertyId]/deal-analysis-calculator";
import { PropertyPhoto } from "@/app/properties/property-photo";
import { requireOwner } from "@/lib/auth";
import { latestAcquisitionGates } from "@/lib/acquisition-gate-versioning";
import { evaluateComparableSales } from "@/lib/comp-engine";
import { getPrisma } from "@/lib/prisma";
import { evaluatePropertyPresentation } from "@/lib/property-presentation-policy";

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
  const property = await getPrisma().property.findUnique({
    where: { id: propertyId },
    include: {
      researchFindings: { orderBy: { observedAt: "desc" } },
      media: { orderBy: { position: "asc" }, take: 5 },
      comparableSales: true,
      discoveryReferences: { orderBy: { submittedAt: "desc" } },
      matches: {
        include: { developer: true },
        orderBy: { score: "desc" },
        take: 5,
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          documents: true,
          approvals: true,
          financialProjections: { orderBy: { version: "desc" }, take: 1 },
          acquisitionFunnel: {
            include: { gates: true, blockers: { where: { status: "OPEN" } } },
          },
        },
      },
    },
  });
  if (!property) notFound();
  const transaction = property.transactions[0];
  const projection = transaction?.financialProjections[0];
  const verified = property.researchFindings.filter(
    (finding) => finding.status === "VERIFIED",
  );
  const conflicts = property.researchFindings.filter(
    (finding) => finding.status === "CONFLICT",
  );
  const presentation = evaluatePropertyPresentation(transaction ?? null);
  const gates = transaction?.acquisitionFunnel
    ? latestAcquisitionGates(transaction.acquisitionFunnel.gates)
    : [];
  const nextAction =
    transaction?.controlStatus === "STOPPED"
      ? "Stopped by owner"
      : conflicts.length
        ? "Resolve conflicting evidence"
        : !transaction
          ? "Build seller relationship and verify deal terms"
          : !presentation.allowed
            ? "Complete contract and disposition controls"
            : "Review approved buyer presentation";
  const confidence = verified.length
    ? Math.round(
        verified.reduce((sum, item) => sum + item.confidence, 0) /
          verified.length,
      )
    : null;
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
        <section aria-label="Property photos" className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm">
          {property.media.length ? (
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
              <div className="sm:col-span-2 lg:row-span-2">
                <PropertyPhoto className="h-72 lg:h-[420px]" eager photos={[property.media[0]]} />
              </div>
              {property.media.slice(1, 5).map((item) => (
                <PropertyPhoto className="h-40 lg:h-[208px]" key={item.id} photos={[item]} />
              ))}
            </div>
          ) : (
            <PropertyPhoto className="h-64 lg:h-80" photos={[]} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 text-xs text-slate-600">
            <span>{property.media.length ? `${property.media.length} sourced photo${property.media.length === 1 ? "" : "s"} · internal workspace display` : "No verified source photo available"}</span>
            {property.media[0] ? <a className="font-bold text-blue-700 underline" href={property.media[0].sourceUrl} rel="noreferrer" target="_blank">Open photo source</a> : null}
          </div>
        </section>
        <header className="mt-4 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                Deal Desk
              </p>
              <h1 className="mt-1 text-3xl font-bold">{property.address}</h1>
              <p className="mt-2 text-slate-600">
                {property.city}, {property.state} {property.zipCode}
              </p>
              <p className="mt-4 text-3xl font-bold text-slate-950">{price(property.estimatedValue)}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-700">
                <span>{property.propertyType || "Property type unknown"}</span>
                <span>{property.yearBuilt ? `Built ${property.yearBuilt}` : "Year built unknown"}</span>
                <span>{property.lotSize || "Lot size unknown"}</span>
              </div>
            </div>
            <span className="w-fit rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
              {transaction?.acquisitionFunnel?.stage.replaceAll("_", " ") ??
                "DISCOVERED"}
            </span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Summary
              label="Known price"
              value={price(property.estimatedValue)}
            />
            <Summary
              label="Evidence confidence"
              value={
                confidence == null ? "Insufficient evidence" : `${confidence}%`
              }
            />
            <Summary
              label="Projected base spread"
              value={dollars(projection?.feeBaseCents)}
            />
            <Summary
              label="Seller-safe maximum"
              value={dollars(projection?.sellerSafeMaximumCents)}
            />
            <Summary
              label="Qualified matches"
              value={String(property.matches.length)}
            />
          </div>
          <div className="mt-5 rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase text-blue-700">
              Recommended next action
            </p>
            <p className="mt-1 font-bold">{nextAction}</p>
          </div>
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
