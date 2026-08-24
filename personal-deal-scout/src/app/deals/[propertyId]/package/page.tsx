import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { evaluateComparableSales } from "@/lib/comp-engine";
import { packageReadiness } from "@/lib/deal-package";
import { getPrisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
const money = (cents?: bigint | null) =>
  cents == null
    ? "Insufficient verified data"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(cents / BigInt(100));
export default async function DealPackagePage({
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
      comparableSales: true,
      media: true,
      matches: {
        include: { developer: true },
        orderBy: { score: "desc" },
        take: 5,
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          financialProjections: { orderBy: { version: "desc" }, take: 1 },
          acquisitionFunnel: true,
        },
      },
    },
  });
  if (!property) notFound();
  const transaction = property.transactions[0];
  const projection = transaction?.financialProjections[0];
  const verified = property.researchFindings.filter(
    (item) => item.status === "VERIFIED",
  );
  const conflicts = property.researchFindings.filter(
    (item) => item.status === "CONFLICT",
  );
  const comps = evaluateComparableSales(
    {
      propertyType: property.propertyType,
      yearBuilt: property.yearBuilt ? Number(property.yearBuilt) : null,
    },
    property.comparableSales.map((item) => ({
      ...item,
      distanceMiles: Number(item.distanceMiles),
      soldPriceCents: item.soldPriceCents,
      bedrooms: item.bedrooms ? Number(item.bedrooms) : null,
      bathrooms: item.bathrooms ? Number(item.bathrooms) : null,
    })),
  );
  const readiness = packageReadiness({
    propertySourceUrl: property.sourceUrl,
    verifiedFindingCount: verified.length,
    conflictCount: conflicts.length,
    transactionControlStatus: transaction?.controlStatus,
    projectionEvidence: Boolean(projection),
    media: property.media,
  });
  return (
    <main className="mx-auto max-w-5xl bg-white p-8 text-slate-950">
      <div className="flex items-center justify-between print:hidden">
        <Link
          className="font-bold text-blue-700"
          href={`/deals/${property.id}`}
        >
          ← Deal Desk
        </Link>
        <PrintButton />
      </div>
      <header className="mt-8 border-b pb-6">
        <p className="text-sm font-bold text-blue-700">
          Coleman & Co. Holdings LLC
        </p>
        <h1 className="mt-2 text-4xl font-bold">Deal Package</h1>
        <p className="mt-2 text-xl">
          {property.address}, {property.city}, {property.state}{" "}
          {property.zipCode}
        </p>
        <p className="mt-3 text-sm">
          Generated {new Date().toLocaleString()} · Evidence-supported work
          product
        </p>
      </header>
      {!readiness.ready ? (
        <section className="mt-6 rounded-xl bg-amber-50 p-5">
          <h2 className="font-bold">Package remains internal</h2>
          <p className="mt-2 text-sm">
            Blocked: {readiness.blockers.join(", ").replaceAll("_", " ")}.
          </p>
        </section>
      ) : null}
      <Section title="Property summary">
        <Grid
          rows={[
            [
              "Opportunity status",
              property.opportunityStatus.replaceAll("_", " "),
            ],
            [
              "Owner/contact",
              property.contactName || property.ownerName || "Unknown",
            ],
            [
              "Known price",
              property.estimatedValue
                ? `$${property.estimatedValue.toLocaleString()}`
                : "Unknown",
            ],
            ["Property type", property.propertyType || "Unknown"],
            [
              "Pipeline stage",
              transaction?.acquisitionFunnel?.stage.replaceAll("_", " ") ||
                "DISCOVERED",
            ],
          ]}
        />
      </Section>
      <Section title="Comparable-sales methodology">
        <Grid
          rows={[
            ["Selected comps", String(comps.selected.length)],
            ["Quality score", `${comps.qualityScore}/100`],
            [
              "Value range",
              comps.valueLowCents
                ? `${money(comps.valueLowCents)} – ${money(comps.valueHighCents)}`
                : "Insufficient verified data",
            ],
            ["Confidence", comps.confidence],
          ]}
        />
        <p className="mt-3 text-xs">{comps.disclaimer}</p>
        {comps.selected.map((item) => (
          <p className="mt-2 text-sm" key={item.id}>
            <b>{item.address}</b> · {money(item.soldPriceCents)} ·{" "}
            {item.reasons.join(" ")} ·{" "}
            <a className="text-blue-700 underline" href={item.sourceUrl}>
              source
            </a>
          </p>
        ))}
      </Section>
      <Section title="Projected economics">
        <Grid
          rows={[
            [
              "Buyer price range",
              projection
                ? `${money(projection.buyerPriceLowCents)} – ${money(projection.buyerPriceHighCents)}`
                : "Insufficient verified data",
            ],
            [
              "Projected fee range",
              projection
                ? `${money(projection.feeLowCents)} – ${money(projection.feeHighCents)}`
                : "Insufficient verified data",
            ],
            [
              "Probability-weighted",
              money(projection?.probabilityWeightedCents),
            ],
            ["Seller-safe maximum", money(projection?.sellerSafeMaximumCents)],
          ]}
        />
        <p className="mt-3 text-xs">
          Projected figures are not guaranteed or realized revenue. Realized
          profit requires closing documentation.
        </p>
      </Section>
      <Section title="Buyer/developer fit">
        {property.matches.map((match, index) => (
          <p className="mt-2 text-sm" key={match.id}>
            <b>
              #{index + 1} {match.developer.companyName}
            </b>{" "}
            · {match.score}/100 · {match.reasons.join(" ")}
          </p>
        ))}
        {!property.matches.length ? <p>None verified.</p> : null}
      </Section>
      <Section title="Evidence and risks">
        {verified.map((item) => (
          <p className="mt-2 text-sm" key={item.id}>
            <b>{item.label}:</b> {item.value || "Recorded"} · {item.confidence}%
            ·{" "}
            {item.sourceUrl ? (
              <a className="text-blue-700 underline" href={item.sourceUrl}>
                source
              </a>
            ) : (
              "source missing"
            )}
          </p>
        ))}
        {conflicts.map((item) => (
          <p className="mt-2 text-sm text-red-700" key={item.id}>
            <b>Conflict:</b> {item.label}
          </p>
        ))}
      </Section>
      <Section title="Approved media">
        {readiness.externalMedia.map((item) => (
          <p className="mt-2 text-sm" key={item.id}>
            <a className="text-blue-700 underline" href={item.sourceUrl}>
              {item.sourceName}
            </a>{" "}
            · {item.rightsStatus.replaceAll("_", " ")}
          </p>
        ))}
        {!readiness.externalMedia.length ? (
          <p className="text-sm">
            No externally approved media. Source links remain available without
            copying imagery.
          </p>
        ) : null}
      </Section>
      <footer className="mt-10 border-t pt-4 text-xs text-slate-500">
        This package is research and transaction work product, not an appraisal,
        title opinion, legal opinion, contractor bid, financing commitment,
        buyer commitment, or guarantee of profit.
      </footer>
    </main>
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
    <section className="mt-8">
      <h2 className="border-b pb-2 text-2xl font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
function Grid({ rows }: { rows: string[][] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
