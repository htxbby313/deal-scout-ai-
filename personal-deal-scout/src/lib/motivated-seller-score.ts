export type SellerSignalProperty = {
  ownerName?: string | null;
  leadSource?: string | null;
  sourceName?: string | null;
  opportunityStatus?: string | null;
  notes?: string | null;
  estimatedValue?: number | null;
  researchFindings?: Array<{
    topic?: string | null;
    label?: string | null;
    value?: string | null;
    notes?: string | null;
    status?: string | null;
  }>;
};

export type MotivatedSellerScore = {
  eligible: boolean;
  motivationScore: number;
  feasibilityScore: number;
  signals: string[];
  blockers: string[];
};

const contains = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));
const money = (value?: string | null) => {
  const parsed = Number((value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export function scoreMotivatedSeller(property: SellerSignalProperty): MotivatedSellerScore {
  const findingText = (property.researchFindings ?? [])
    .filter((finding) => finding.status !== "NOT_FOUND")
    .map((finding) => [finding.topic, finding.label, finding.value, finding.notes].filter(Boolean).join(" "))
    .join(" ");
  const text = [property.leadSource, property.sourceName, property.notes, findingText].filter(Boolean).join(" ").toLowerCase();
  const owner = (property.ownerName ?? "").toLowerCase();
  const governmentOwned = property.opportunityStatus === "GOVERNMENT_SALE" || contains(`${owner} ${text}`, [/\bhud\b/, /housing and urban development/, /government owned/, /government sale/]);
  const lenderOwned = contains(owner, [/\bbank\b/, /mortgage/, /fannie mae/, /freddie mac/]) || contains(text, [/\breo\b/, /bank owned/]);
  if (governmentOwned || lenderOwned) {
    return { eligible: false, motivationScore: 0, feasibilityScore: 0, signals: [], blockers: [governmentOwned ? "Government controls the sale" : "Lender controls the sale"] };
  }

  let motivationScore = 0;
  let feasibilityScore = 60;
  const signals: string[] = [];
  const blockers: string[] = [];
  const add = (points: number, label: string) => { motivationScore += points; signals.push(label); };

  if (contains(text, [/\bfsbo\b/, /for sale by owner/, /owner listed/])) add(35, "For sale by owner");
  if (contains(text, [/pre[- ]?foreclosure/, /notice of default/, /lis pendens/, /default notice/])) add(30, "Recorded mortgage/default pressure");
  if (contains(text, [/tax delinquen/, /delinquent tax/, /unpaid tax/, /tax lien/])) add(20, "Tax payment pressure");
  if (contains(text, [/code violation/, /deferred maintenance/, /major repair/, /needs repair/, /as[- ]is/, /fire damage/, /vacant/, /uninhabitable/])) add(15, "Repair or carrying-cost burden");
  if (contains(text, [/underwater/, /negative equity/, /equity shortfall/, /debt exceeds/, /short sale/])) {
    add(25, "Estimated equity shortfall");
    feasibilityScore -= 30;
    blockers.push("Payoff or short-sale path needs verification");
  }
  const debtFinding = (property.researchFindings ?? []).find((finding) => contains(`${finding.topic} ${finding.label}`, [/mortgage balance/, /estimated debt/, /loan balance/, /payoff/]));
  const lienFinding = (property.researchFindings ?? []).find((finding) => contains(`${finding.topic} ${finding.label}`, [/liens? and taxes/, /tax lien/, /recorded lien/]));
  const estimatedDebt = money(debtFinding?.value);
  const liensAndTaxes = money(lienFinding?.value) ?? 0;
  if (property.estimatedValue && estimatedDebt) {
    const estimatedSellingCosts = Math.round(property.estimatedValue * 0.08);
    const estimatedNetEquity = property.estimatedValue - estimatedDebt - liensAndTaxes - estimatedSellingCosts;
    if (estimatedNetEquity <= 0 && !signals.includes("Estimated equity shortfall")) {
      add(25, "Estimated equity shortfall after selling costs");
      feasibilityScore -= 30;
      blockers.push("Mortgage payoff, liens, and selling-cost estimate need verification");
    }
  }
  if (contains(text, [/probate/, /inherited/, /estate sale/, /absentee owner/])) add(10, "Ownership transition or absentee signal");

  if (!property.ownerName || /unknown|research pending/i.test(property.ownerName)) {
    feasibilityScore -= 20;
    blockers.push("Current owner needs verification");
  }
  if (!(property.researchFindings ?? []).some((finding) => finding.status === "VERIFIED")) {
    feasibilityScore -= 15;
    blockers.push("Public-record evidence needs verification");
  }

  return {
    eligible: motivationScore > 0,
    motivationScore: Math.min(100, motivationScore),
    feasibilityScore: Math.max(0, Math.min(100, feasibilityScore)),
    signals,
    blockers,
  };
}
