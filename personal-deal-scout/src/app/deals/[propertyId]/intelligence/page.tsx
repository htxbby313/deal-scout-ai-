import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  getLatestPropertyIntelligence,
  propertyIntelligenceConfigured,
} from "@/lib/property-intelligence";
import { refreshPropertyIntelligenceAction } from "./actions";

export const dynamic = "force-dynamic";

const money = (value?: number) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);

const number = (value?: number, suffix = "") =>
  value == null ? "—" : `${new Intl.NumberFormat("en-US").format(value)}${suffix}`;

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  const rendered = value == null || value === "" ? "—" : String(value);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-slate-950">{rendered}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-slate-50 p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </section>
  );
}

export default async function PropertyIntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ refreshed?: string; error?: string }>;
}) {
  await requireOwner();
  const { propertyId } = await params;
  const query = await searchParams;
  const property = await getPrisma().property.findUnique({
    where: { id: propertyId },
    include: {
      researchFindings: { orderBy: { observedAt: "desc" } },
      discoveryReferences: { orderBy: { submittedAt: "desc" }, take: 10 },
    },
  });
  if (!property) notFound();

  const snapshot = await getLatestPropertyIntelligence(propertyId);
  const intelligence = snapshot?.result;
  const configured = propertyIntelligenceConfigured();
  const zillow = property.discoveryReferences.find((item) =>
    item.providerKey.toLowerCase().includes("zillow"),
  );
  const verifiedFindings = property.researchFindings.filter(
    (item) => item.status === "VERIFIED",
  );

  return (
    <WorkspaceShell active="pipeline">
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-blue-700" href={`/deals/${property.id}`}>
              ← Deal Overview
            </Link>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-blue-700">
              Property Intelligence
            </p>
            <h1 className="mt-1 text-3xl font-bold">{property.address}</h1>
            <p className="mt-2 text-slate-600">
              {property.city}, {property.state} {property.zipCode}
            </p>
          </div>
          <form action={refreshPropertyIntelligenceAction.bind(null, property.id)}>
            <button
              className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              disabled={!configured}
            >
              {snapshot ? "Refresh full intelligence" : "Run full intelligence"}
            </button>
          </form>
        </div>

        {query.refreshed ? (
          <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
            Property intelligence refreshed from the connected property source.
          </p>
        ) : null}
        {query.error ? (
          <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-900">
            {decodeURIComponent(query.error)}
          </p>
        ) : null}
        {!configured ? (
          <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            No full property source is configured in this environment. Existing Deal Scout research remains available below.
          </p>
        ) : null}

        <div className="mt-6 grid gap-6">
          <Section title="Ownership">
            <Fact label="Owner" value={intelligence?.ownerNames.join(", ") || property.ownerName} />
            <Fact label="Owner type" value={intelligence?.ownerType} />
            <Fact label="Owner occupied" value={intelligence?.ownerOccupied} />
            <Fact label="Mailing address" value={intelligence?.mailingAddress} />
            <Fact label="Contact" value={property.contactName} />
            <Fact label="Phone" value={property.contactPhone} />
          </Section>

          <Section title="Tax & Assessment">
            <Fact label="Annual tax" value={money(intelligence?.taxAmount)} />
            <Fact label="Assessed land value" value={money(intelligence?.assessedLandValue)} />
            <Fact label="Assessed improvement value" value={money(intelligence?.assessedImprovementValue)} />
            <Fact label="Total assessed value" value={money(intelligence?.assessedValue)} />
            <Fact label="Market / appraised value" value={money(intelligence?.marketValue)} />
            <Fact label="Assessment year" value={intelligence?.assessedYear} />
            <Fact label="Tax year" value={intelligence?.taxYear} />
          </Section>

          <Section title="Parcel">
            <Fact label="APN" value={intelligence?.apn} />
            <Fact label="Alternate parcel ID" value={intelligence?.alternateParcelId} />
            <Fact label="Legal description" value={intelligence?.legalDescription} />
            <Fact label="Land use" value={intelligence?.landUse || property.propertyType} />
            <Fact label="Zoning" value={intelligence?.zoning} />
            <Fact label="Lot size" value={intelligence?.dimensions || property.lotSize} />
            <Fact label="Land square feet" value={number(intelligence?.landSquareFeet, " sq ft")} />
            <Fact label="Acres" value={number(intelligence?.acres)} />
            <Fact label="Frontage" value={number(intelligence?.frontageFeet, " ft")} />
            <Fact label="Depth" value={number(intelligence?.depthFeet, " ft")} />
          </Section>

          <Section title="Improvements & Features">
            <Fact label="Year built" value={intelligence?.yearBuilt || property.yearBuilt} />
            <Fact label="Building square feet" value={number(intelligence?.buildingSquareFeet, " sq ft")} />
            <Fact label="Bedrooms" value={intelligence?.bedrooms} />
            <Fact label="Bathrooms" value={intelligence?.bathrooms} />
            <Fact label="Construction type" value={intelligence?.constructionType} />
            <Fact label="Garage / parking" value={intelligence?.garage} />
            <Fact label="Parking spaces" value={intelligence?.parkingSpaces} />
            <Fact label="Pool" value={intelligence?.pool} />
            <Fact label="Units" value={intelligence?.numberOfUnits} />
          </Section>

          <Section title="Utilities & Identifiers">
            <Fact label="Utilities" value={intelligence?.utilities} />
            <Fact label="APN" value={intelligence?.apn} />
            <Fact label="Zillow reference" value={zillow?.originalUrl || "—"} />
            <Fact label="MLS ID" value="Not available from the current source" />
          </Section>

          <section className="rounded-2xl border bg-white p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold">Evidence & Sources</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {verifiedFindings.length} verified Deal Scout research findings are attached to this property.
                </p>
              </div>
              {snapshot ? (
                <a
                  className="text-sm font-bold text-blue-700 underline"
                  href={snapshot.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Property source documentation
                </a>
              ) : null}
            </div>
            {snapshot ? (
              <p className="mt-3 text-xs text-slate-500">
                Full intelligence captured {new Date(snapshot.capturedAt).toLocaleString("en-US")}. Source: {snapshot.sourceName}.
              </p>
            ) : (
              <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Run full intelligence once to capture richer owner, tax, parcel, and structure fields. RentCast is tried first when configured, and the result is cached so simply opening this page does not consume another lookup.
              </p>
            )}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {verifiedFindings.slice(0, 12).map((finding) => (
                <article className="rounded-xl border p-3" key={finding.id}>
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Verified</p>
                  <p className="mt-1 text-sm font-bold">{finding.label}</p>
                  {finding.value ? <p className="mt-1 text-xs text-slate-600">{finding.value}</p> : null}
                  {finding.sourceUrl ? (
                    <a
                      className="mt-2 block text-xs font-bold text-blue-700 underline"
                      href={finding.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open source
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </WorkspaceShell>
  );
}
