export type LandDealWatchStatus =
  | "READY TO CONTACT TODAY"
  | "NEEDS ONE VERIFICATION"
  | "NEGOTIATE"
  | "KILL";

export type WorkflowEvidence = {
  topic: string;
  label: string;
  value?: string | null;
  status: "VERIFIED" | "NOT_FOUND" | "CONFLICT" | "NEEDS_MANUAL_VERIFICATION";
  sourceUrl?: string | null;
  notes?: string | null;
};

export type LandDealWatchInput = {
  address: string;
  ownerName?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactUrl?: string | null;
  askingPriceCents?: bigint | null;
  findings: readonly WorkflowEvidence[];
  closedCompValueLowCents?: bigint | null;
  closedCompValueBaseCents?: bigint | null;
  closedCompValueHighCents?: bigint | null;
  closedCompCount: number;
  buyerNames: readonly string[];
  buyerValueBaseCents?: bigint | null;
  sellerSafeMaximumCents?: bigint | null;
  projectedSpreadCents?: bigint | null;
  conversationSummaries: readonly string[];
};

export type LandDealWatchBrief = {
  status: LandDealWatchStatus;
  whyThisLead: string;
  whyThisMessage: string;
  angle: string;
  evidence: { closedSales: string; activeAsks: string; assessments: string; avms: string };
  motivation: string[];
  diligence: Array<{ label: string; state: "verified" | "missing" | "conflict"; detail: string }>;
  conflicts: string[];
  exit: string;
  value: string;
  acquisitionRange: { opening: bigint | null; target: bigint | null; ceiling: bigint | null };
  spread: string;
  contact: string;
  outreach: { call: string; text: string; email: string };
  nextAction: string;
  advanceIf: string[];
  killIf: string[];
  alternateAngles: string[];
};

const REQUIRED_TOPICS = [
  ["LISTING", "Active status and ask"], ["PARCEL", "Parcel and acreage"],
  ["ZONING", "Zoning, entitlement, subdivision, and plausible yield"], ["DIMENSIONS", "Frontage and dimensions"],
  ["ACCESS", "Legal access"], ["UTILITIES", "Utilities"],
  ["EASEMENTS", "Easements"], ["LIENS", "Title and liens"],
  ["FLOOD", "Floodplain / floodway"], ["ENVIRONMENTAL", "Drainage, detention, and environmental"],
  ["STRUCTURES", "Structures, occupancy, condition, and buildability"],
] as const;

const money = (value?: bigint | null) => value == null ? "unsupported" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) / 100);
const hasWords = (items: readonly string[], pattern: RegExp) => items.some((item) => pattern.test(item));

export function buildLandDealWatchBrief(input: LandDealWatchInput, requestedAngle = 0): LandDealWatchBrief {
  const byTopic = new Map(input.findings.map((finding) => [finding.topic.toUpperCase(), finding]));
  const conflicts = input.findings.filter((item) => item.status === "CONFLICT").map((item) => `${item.label}: ${item.value || item.notes || "sources disagree"}`);
  const diligence = REQUIRED_TOPICS.map(([topic, label]) => {
    const finding = byTopic.get(topic);
    return {
      label,
      state: finding?.status === "CONFLICT" ? "conflict" as const : finding?.status === "VERIFIED" || finding?.status === "NOT_FOUND" ? "verified" as const : "missing" as const,
      detail: finding?.value || finding?.notes || "Not yet supported by dated source evidence",
    };
  });
  const text = [...input.findings.flatMap((item) => [item.value || "", item.notes || ""]), ...input.conversationSummaries];
  const motivation = [
    hasWords(text, /\b(days on market|dom|\d+ days)\b/i) ? "Days on market documented" : null,
    hasWords(text, /price (cut|drop|reduc)|relisted|back on market/i) ? "Price cut or relist documented" : null,
    hasWords(text, /motivated|bring (all )?offers|must sell|as[- ]is|quick clos/i) ? "Seller or listing motivation language documented" : null,
    input.conversationSummaries.length ? "Seller conversation evidence recorded" : null,
  ].filter((item): item is string => Boolean(item));
  const contactVerified = Boolean((input.contactPhone || input.contactEmail || input.contactUrl) && byTopic.get("CONTACT")?.status === "VERIFIED");
  const listingVerified = byTopic.get("LISTING")?.status === "VERIFIED" && input.askingPriceCents != null;
  const missing = diligence.filter((item) => item.state === "missing");
  const fatal = hasWords(text, /no legal access|unbuildable|condemned|seller (declined|not interested)|do not contact/i);
  const status: LandDealWatchStatus = fatal ? "KILL" : input.conversationSummaries.length && !conflicts.length ? "NEGOTIATE" : listingVerified && contactVerified && !conflicts.length && missing.length <= 1 ? "READY TO CONTACT TODAY" : conflicts.length || missing.length ? "NEEDS ONE VERIFICATION" : "READY TO CONTACT TODAY";

  const angles = [
    motivation.length ? "seller timing and certainty" : "property plans and fit",
    input.buyerNames.length ? "a potential nearby builder fit to verify" : "development feasibility before price",
    conflicts.length ? "resolve the conflicting property facts" : "as-is convenience and flexible closing",
  ];
  const angle = angles[((requestedAngle % angles.length) + angles.length) % angles.length];
  const recipient = input.contactName || input.ownerName || "there";
  const detail = angle === angles[0]
    ? "whether timing, certainty, or an as-is sale matters more than testing the full market"
    : angle === angles[1]
      ? "what has already been confirmed about the site's use and what still needs verification"
      : "the one or two facts that must be reconciled before discussing a responsible price";
  const supportedExit = input.closedCompCount >= 3 && input.closedCompValueBaseCents != null;
  // Closed comps may support exit value, but they do not account for acquisition
  // costs. Never turn a comp price directly into an offer ceiling.
  const ceiling = supportedExit ? (input.sellerSafeMaximumCents ?? null) : null;
  const opening = ceiling == null ? null : ceiling * BigInt(80) / BigInt(100);
  const target = ceiling == null ? null : ceiling * BigInt(90) / BigInt(100);
  const sourceKinds = input.findings.filter((item) => item.status === "VERIFIED");
  const active = sourceKinds.filter((item) => /LISTING|PRICE/.test(item.topic)).length;
  const tax = sourceKinds.filter((item) => item.topic === "TAX").length;
  const avm = sourceKinds.filter((item) => /AVM|ESTIMATE/.test(item.topic)).length;
  const exit = input.buyerNames.length ? `Potential exit candidates: ${input.buyerNames.join(", ")}. These are internal matches—not verified demand—until buyer criteria, evidence, interest, and communication permission are confirmed.` : "No supportable nearby builder/developer exit is documented yet.";
  const opener = `Hi ${recipient}, I'm Tay with Coleman & Co. Holdings LLC. I'm looking at ${input.address} and wanted to ask about ${detail}. Would you be open to a brief conversation?`;

  return {
    status, angle, motivation, diligence, conflicts,
    whyThisLead: motivation.length ? `${motivation.join("; ")}. The lead still has to pass the evidence and buildability gates below.` : "The property entered discovery, but seller motivation is not yet supported. Treat it as a candidate, not a deal.",
    whyThisMessage: `This version leads with ${angle}; that angle is supported by the current record and avoids inventing price, distress, or buyer certainty.`,
    evidence: {
      closedSales: supportedExit ? `${input.closedCompCount} verified closed sales support ${money(input.closedCompValueLowCents)}–${money(input.closedCompValueHighCents)}; base ${money(input.closedCompValueBaseCents)}.` : `${input.closedCompCount} verified closed sale(s); at least 3 suitable sales are required to derive value.`,
      activeAsks: active ? `${active} verified active ask/listing finding(s), used only for competition and seller-position context.` : "No verified active ask evidence.",
      assessments: tax ? `${tax} tax/assessment finding(s), shown as tax evidence and not market value.` : "No assessment evidence.",
      avms: avm ? `${avm} AVM finding(s), shown as estimates and not closed-sale evidence.` : "No AVM evidence used.",
    },
    exit,
    value: supportedExit ? `Buyer value is supportable from closed sales at ${money(input.closedCompValueBaseCents)} base. ${input.buyerValueBaseCents ? `Recorded buyer scenario: ${money(input.buyerValueBaseCents)}.` : "No separate verified buyer price is recorded."}` : "Buyer value is not supportable yet; active asks, assessments, and AVMs are not substituted for closed sales.",
    acquisitionRange: { opening, target, ceiling },
    spread: supportedExit && ceiling != null && input.projectedSpreadCents != null ? `Projected spread ${money(input.projectedSpreadCents)}; projection only, subject to buyer demand, diligence, title, and closing.` : "Assignment/JV/flip spread is withheld until exit value, acquisition ceiling, and deal costs are supportable.",
    contact: contactVerified ? `Public contact route verified: ${input.contactName || input.ownerName || "property contact"} · ${input.contactPhone || input.contactEmail || input.contactUrl}` : "Public agent/seller/business contact route still requires evidence verification.",
    outreach: { call: opener, text: opener, email: `Subject: Question about ${input.address}\n\n${opener}\n\nThank you,\nTay\nColeman & Co. Holdings LLC` },
    nextAction: fatal ? "Record the disqualifying evidence and stop work on this lead." : conflicts.length ? `Resolve: ${conflicts[0]}.` : missing.length ? `Verify ${missing[0].label.toLowerCase()} from a dated authoritative source.` : !contactVerified ? "Verify a public contact route before owner-reviewed outreach." : input.conversationSummaries.length ? "Review the newest call note, refresh terms, and prepare the evidence-supported negotiation range." : "Owner-review the property-specific message and place the call today.",
    advanceIf: ["Active status, price, parcel identity, and contact route remain verified", "Buildability and legal-access gates have no unresolved conflict", "Closed comps or verified buyer evidence support the exit and ceiling"],
    killIf: ["Seller declines or contact is suppressed", "No legal access or a fatal buildability/title issue is verified", "Seller floor exceeds the evidence-supported ceiling after all costs"],
    alternateAngles: angles,
  };
}
