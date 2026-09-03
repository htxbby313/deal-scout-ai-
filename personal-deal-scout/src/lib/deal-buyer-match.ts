import { formatSourceRecordDate } from "@/lib/domain";

export type BuyerMatchProperty = {
  city: string;
  state: string;
  zipCode: string;
};

export type BuyerMatchProject = {
  city: string;
  state: string;
  zipCode: string;
  originalPurchasePrice?: number | null;
  sourceRecordDate?: string | null;
  verifiedAt?: Date | string | null;
  sourceUrl?: string | null;
};

export type BuyerMatchDeveloper = {
  id: string;
  companyName: string;
  qualificationStatus: string;
  phone?: string | null;
  email?: string | null;
  projects?: BuyerMatchProject[] | null;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

function isVerifiedProject(project: BuyerMatchProject) {
  return Boolean(project.verifiedAt && project.sourceUrl);
}

function sameCity(property: BuyerMatchProperty, project: BuyerMatchProject) {
  return (
    project.city.trim().toLowerCase() === property.city.trim().toLowerCase() &&
    project.state === property.state
  );
}

function projectTime(project: BuyerMatchProject) {
  const raw = project.sourceRecordDate?.trim();
  if (raw) {
    const numeric = Number(raw);
    const date = Number.isFinite(numeric)
      ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
      : new Date(raw);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  if (project.verifiedAt) {
    const date = new Date(project.verifiedAt);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return 0;
}

function observedDateLabel(project: BuyerMatchProject) {
  const raw = project.sourceRecordDate?.trim();
  if (raw) {
    const formatted = formatSourceRecordDate(raw);
    if (formatted !== "Missing" && formatted !== "Unrecognized date") {
      return formatted;
    }
  }
  if (project.verifiedAt) {
    const date = new Date(project.verifiedAt);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
        date,
      );
    }
  }
  return null;
}

export function countVerifiedProjects(projects?: BuyerMatchProject[] | null) {
  return (projects ?? []).filter(isVerifiedProject).length;
}

export function isDealBoxWorkingSetDeveloper(
  qualificationStatus: string,
  verifiedProjectCount: number,
) {
  return !(
    qualificationStatus === "RESEARCH_NEEDED" && verifiedProjectCount === 0
  );
}

export function pickComparableVerifiedProject(
  property: BuyerMatchProperty,
  projects?: BuyerMatchProject[] | null,
) {
  const verified = (projects ?? []).filter(isVerifiedProject);
  const zipMatches = verified.filter(
    (project) => project.zipCode === property.zipCode,
  );
  const cityMatches = verified.filter((project) => sameCity(property, project));
  const pool = zipMatches.length ? zipMatches : cityMatches;
  if (!pool.length) return null;
  return [...pool].sort((left, right) => {
    const priceRank =
      Number(Boolean(right.originalPurchasePrice)) -
      Number(Boolean(left.originalPurchasePrice));
    if (priceRank) return priceRank;
    return projectTime(right) - projectTime(left);
  })[0];
}

export function formatComparablePurchase(project: BuyerMatchProject | null) {
  if (!project) return null;
  const city = project.city.trim() || project.zipCode;
  const price =
    project.originalPurchasePrice && project.originalPurchasePrice > 0
      ? money(project.originalPurchasePrice)
      : "price not recorded";
  const date = observedDateLabel(project);
  return date ? `${city} · ${price} · ${date}` : `${city} · ${price}`;
}

export function contactReadinessLabel(qualificationStatus: string) {
  if (qualificationStatus === "PRIORITY") return "Priority — relationship ready";
  if (qualificationStatus === "QUALIFIED")
    return "Qualified — relationship ready";
  if (qualificationStatus === "LIMITED_CONTACT") return "Limited contact";
  if (qualificationStatus === "RESEARCH_NEEDED") return "Research needed";
  return qualificationStatus.replaceAll("_", " ");
}

function statedReason(reasons: readonly string[]) {
  return reasons.find((reason) =>
    /imported (acquisition )?criteria|stated broad U\.S\. coverage|confirm the buy box/i.test(
      reason,
    ),
  );
}

export function explainBuyerMatch(input: {
  reasons: readonly string[];
  comparable: BuyerMatchProject | null;
  verifiedProjectCount: number;
}) {
  const comparable = input.comparable;
  if (comparable) {
    const place = comparable.zipCode || comparable.city;
    const date = observedDateLabel(comparable);
    if (comparable.originalPurchasePrice && comparable.originalPurchasePrice > 0) {
      return date
        ? `Bought a verified project in ${place} for ${money(comparable.originalPurchasePrice)} (${date}).`
        : `Bought a verified project in ${place} for ${money(comparable.originalPurchasePrice)}.`;
    }
    return date
      ? `Has a verified project in ${place} (${date}); purchase price is not on file.`
      : `Has a verified project in ${place}; purchase price is not on file.`;
  }
  if (input.verifiedProjectCount > 0) {
    return `Has ${input.verifiedProjectCount} verified project${input.verifiedProjectCount === 1 ? "" : "s"}, but none in this ZIP or city.`;
  }
  const zipReason = input.reasons.find((reason) =>
    /same ZIP code/i.test(reason),
  );
  if (zipReason) {
    return "Stated ZIP targeting matches this property; no verified purchase history here.";
  }
  if (statedReason(input.reasons)) {
    return "Stated criteria name this market; no verified purchase history here.";
  }
  return "Match is based on contact route and price fit, not verified purchase history.";
}

export function selectDealBoxBuyerMatches<
  T extends { developer: BuyerMatchDeveloper },
>(matches: readonly T[]) {
  return matches.filter((match) =>
    isDealBoxWorkingSetDeveloper(
      match.developer.qualificationStatus,
      countVerifiedProjects(match.developer.projects),
    ),
  );
}

export function presentDealBoxBuyerMatch(input: {
  score: number;
  reasons: readonly string[];
  developer: BuyerMatchDeveloper;
  property: BuyerMatchProperty;
  presentationAllowed: boolean;
}) {
  const comparable = pickComparableVerifiedProject(
    input.property,
    input.developer.projects,
  );
  const verifiedProjectCount = countVerifiedProjects(input.developer.projects);
  return {
    companyName: input.developer.companyName,
    score: input.score,
    explanation: explainBuyerMatch({
      reasons: input.reasons,
      comparable,
      verifiedProjectCount,
    }),
    comparableLine: formatComparablePurchase(comparable),
    contactReadiness: input.presentationAllowed
      ? contactReadinessLabel(input.developer.qualificationStatus)
      : "Internal only — do not call or send this deal",
    internalOnly: !input.presentationAllowed,
    shoppableLabel: input.presentationAllowed
      ? "Shoppable"
      : "Not shoppable",
  };
}
