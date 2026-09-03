import { formatSourceRecordDate } from "@/lib/domain";

export type ListingFactFinding = {
  topic: string;
  status: string;
  value?: string | null;
};

export type ListingFacts = {
  yearBuilt: string | null;
  lotSize: string | null;
  sourceDate: string | null;
  listing: string | null;
  dimensions: string | null;
};

function verifiedValue(
  findings: readonly ListingFactFinding[],
  topic: string,
) {
  const finding = findings.find(
    (item) => item.topic === topic && item.status === "VERIFIED" && item.value,
  );
  return finding?.value ?? null;
}

export function listingFacts(input: {
  yearBuilt?: string | null;
  lotSize?: string | null;
  sourceRecordDate?: string | null;
  researchFindings?: readonly ListingFactFinding[] | null;
}): ListingFacts {
  const year = input.yearBuilt?.trim() || null;
  const lot = input.lotSize?.trim() || null;
  const recorded = formatSourceRecordDate(input.sourceRecordDate);
  const sourceDate =
    recorded === "Missing" || recorded === "Unrecognized date" ? null : recorded;
  const findings = input.researchFindings ?? [];
  return {
    yearBuilt: year,
    lotSize: lot,
    sourceDate,
    listing: verifiedValue(findings, "LISTING"),
    dimensions: verifiedValue(findings, "DIMENSIONS"),
  };
}

export function listingFactLines(facts: ListingFacts) {
  const lines: { label: string; value: string }[] = [];
  if (facts.yearBuilt) lines.push({ label: "Year", value: facts.yearBuilt });
  if (facts.lotSize) lines.push({ label: "Lot", value: facts.lotSize });
  if (facts.dimensions)
    lines.push({ label: "Dimensions", value: facts.dimensions });
  if (facts.sourceDate)
    lines.push({ label: "Source date", value: facts.sourceDate });
  if (facts.listing) lines.push({ label: "Listing", value: facts.listing });
  return lines;
}
