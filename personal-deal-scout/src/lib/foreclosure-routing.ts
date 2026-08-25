import { z } from "zod";

export const foreclosureStageSchema = z.enum([
  "PRE_FORECLOSURE",
  "AUCTION_SCHEDULED",
  "HUD_OWNED",
  "BANK_REO",
  "TAX_FORECLOSURE",
  "UNKNOWN",
]);
export type ForeclosureStage = z.infer<typeof foreclosureStageSchema>;

export const acquisitionRouteSchema = z.enum([
  "OWNER_OUTREACH",
  "AUCTION_DILIGENCE",
  "HUD_BROKER_BID",
  "REO_LISTING_AGENT",
  "TAX_SALE",
  "VERIFY_STATUS",
]);
export type AcquisitionRoute = z.infer<typeof acquisitionRouteSchema>;

export type ForeclosureRoutingInput = {
  stage?: string | null;
  ownerName?: string | null;
  preforeclosure?: boolean;
  auctionDate?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  authorizedSaleUrl?: string | null;
  estimatedValue?: number | null;
  estimatedDebt?: number | null;
  liensAndTaxes?: number | null;
};

export type ForeclosureRoutingDecision = {
  stage: ForeclosureStage;
  route: AcquisitionRoute;
  status: "READY_FOR_DILIGENCE" | "NEEDS_VERIFICATION" | "NOT_ACTIONABLE";
  nextAction: string;
  canContactOwner: boolean;
  estimatedEquity?: number;
  blockers: string[];
  reasons: string[];
};

const normalized = (value?: string | null) => (value ?? "").trim().toLowerCase();

function detectStage(input: ForeclosureRoutingInput): ForeclosureStage {
  const explicit = normalized(input.stage).replaceAll("-", "_").replaceAll(" ", "_").toUpperCase();
  if (foreclosureStageSchema.safeParse(explicit).success) return explicit as ForeclosureStage;
  const owner = normalized(input.ownerName);
  const source = normalized(input.sourceName);
  if (owner.includes("housing and urban development") || owner === "hud" || source.includes("hud fha")) return "HUD_OWNED";
  if (input.preforeclosure) return "PRE_FORECLOSURE";
  if (input.auctionDate) return "AUCTION_SCHEDULED";
  if (owner.includes("bank") || owner.includes("mortgage") || owner.includes("trust")) return "BANK_REO";
  if (source.includes("tax sale") || source.includes("tax foreclosure")) return "TAX_FORECLOSURE";
  return "UNKNOWN";
}

export function routeForeclosure(input: ForeclosureRoutingInput): ForeclosureRoutingDecision {
  const stage = detectStage(input);
  const estimatedEquity =
    input.estimatedValue != null && input.estimatedDebt != null
      ? input.estimatedValue - input.estimatedDebt - (input.liensAndTaxes ?? 0)
      : undefined;
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (!input.sourceUrl) blockers.push("Official status source is missing");
  if (!input.ownerName || normalized(input.ownerName).includes("unknown")) blockers.push("Current legal owner is unverified");

  if (stage === "PRE_FORECLOSURE") {
    if (estimatedEquity == null) blockers.push("Equity is unverified");
    else if (estimatedEquity <= 0) blockers.push("No positive equity is currently indicated");
    reasons.push("The homeowner may still control the property before sale");
    return {
      stage,
      route: "OWNER_OUTREACH",
      status: blockers.length ? "NEEDS_VERIFICATION" : "READY_FOR_DILIGENCE",
      nextAction: blockers.length
        ? "Verify legal owner, foreclosure status, sale date, debt, liens, taxes, and equity before outreach"
        : "Prepare personalized, compliant owner outreach for approval",
      canContactOwner: blockers.length === 0,
      estimatedEquity,
      blockers,
      reasons,
    };
  }

  if (stage === "HUD_OWNED") {
    if (!input.authorizedSaleUrl) blockers.push("Current authorized HUD sale or listing channel is unverified");
    reasons.push("HUD-owned homes use an authorized listing and formal bid process");
    return {
      stage,
      route: "HUD_BROKER_BID",
      status: blockers.length ? "NEEDS_VERIFICATION" : "READY_FOR_DILIGENCE",
      nextAction: "Verify the active HUD listing, bidder period, broker eligibility, contract restrictions, title, occupancy, and repair exposure",
      canContactOwner: false,
      blockers,
      reasons,
    };
  }

  if (stage === "AUCTION_SCHEDULED") {
    if (!input.auctionDate) blockers.push("Auction date is unverified");
    reasons.push("Scheduled foreclosure sales require auction-specific diligence and funding");
    return {
      stage,
      route: "AUCTION_DILIGENCE",
      status: blockers.length ? "NEEDS_VERIFICATION" : "READY_FOR_DILIGENCE",
      nextAction: "Verify trustee, auction terms, opening bid, title, liens, taxes, occupancy, repairs, and available funds",
      canContactOwner: false,
      estimatedEquity,
      blockers,
      reasons,
    };
  }

  if (stage === "BANK_REO") {
    reasons.push("The lender or REO owner controls the sale");
    return {
      stage,
      route: "REO_LISTING_AGENT",
      status: blockers.length ? "NEEDS_VERIFICATION" : "READY_FOR_DILIGENCE",
      nextAction: "Verify current REO ownership and authorized listing or asset-manager contact before preparing an offer",
      canContactOwner: false,
      blockers,
      reasons,
    };
  }

  if (stage === "TAX_FORECLOSURE") {
    reasons.push("Tax foreclosures follow the official jurisdiction sale process");
    return {
      stage,
      route: "TAX_SALE",
      status: blockers.length ? "NEEDS_VERIFICATION" : "READY_FOR_DILIGENCE",
      nextAction: "Verify the official tax-sale notice, redemption rights, title risks, deposit rules, and bidding procedure",
      canContactOwner: false,
      blockers,
      reasons,
    };
  }

  return {
    stage: "UNKNOWN",
    route: "VERIFY_STATUS",
    status: "NEEDS_VERIFICATION",
    nextAction: "Verify foreclosure stage, current legal owner, official source, sale date, debt, liens, taxes, equity, and authorized sale channel",
    canContactOwner: false,
    blockers: [...blockers, "Foreclosure stage is unverified"],
    reasons: ["A foreclosure label alone does not identify who controls the property or how it can be acquired"],
  };
}
