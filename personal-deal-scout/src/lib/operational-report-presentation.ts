import type { Metric } from "@/lib/operational-kpis";
import type { OperationalReportFilters } from "@/lib/operational-report-service";

export const OPERATIONAL_REPORT_SECTIONS = [
  { title: "Money", description: "What the pipeline may produce versus money actually closed.", keys: ["projected_pipeline", "weighted_pipeline", "contracted_pipeline", "realized_profit", "average_closed_profit", "median_closed_profit", "cost_per_seller_reached", "cost_per_qualified_conversation", "cost_per_offer", "cost_per_contract", "cost_per_closed_transaction"] },
  { title: "Deal progress", description: "How opportunities are moving from discovery to a completed transaction.", keys: ["properties_discovered", "properties_researched", "outreach_ready", "owner_approved_contacts", "contact_attempts", "sellers_reached", "qualified_conversations", "offers_prepared", "offers_approved", "offers_delivered", "contracts_signed", "deals_closed", "buyer_prices_requested", "buyer_prices_received", "disposition_packages_approved", "deals_lost", "deals_blocked", "deals_stopped", "deals_archived", "deals_nurtured", "seller_response_rate", "seller_contract_conversion_rate", "outcome_reason_coverage"] },
  { title: "Speed", description: "How long research, contact, and deal stages are taking.", keys: ["research_completion_rate", "discovery_to_contact_hours", "discovery_to_contract_hours", "contract_to_close_hours", "average_stage_hours", "median_stage_hours"] },
  { title: "Attention needed", description: "Evidence, approval, buyer, and agent issues that may slow results.", keys: ["manual_verification_backlog", "research_exception_rate", "evidence_freshness", "owner_approval_queue_age", "buyer_closing_rate", "buyer_retrade_rate", "agent_queue_failures", "agent_retry_count"] },
] as const;

export type OperationalMetricSection = { title: string; description: string; metrics: Metric[]; fallback?: boolean };

export function organizeOperationalMetrics(metrics: readonly Metric[]): OperationalMetricSection[] {
  const configured = new Map<string, string>();
  for (const section of OPERATIONAL_REPORT_SECTIONS) {
    for (const key of section.keys) {
      if (configured.has(key)) throw new Error(`Operational metric ${key} is assigned to more than one section.`);
      configured.set(key, section.title);
    }
  }
  const seen = new Set<string>();
  for (const metric of metrics) {
    if (seen.has(metric.key)) throw new Error(`Operational report returned duplicate metric ${metric.key}.`);
    seen.add(metric.key);
  }
  const sections: OperationalMetricSection[] = OPERATIONAL_REPORT_SECTIONS.map((section) => ({
    title: section.title,
    description: section.description,
    metrics: metrics.filter((metric) => configured.get(metric.key) === section.title),
  })).filter((section) => section.metrics.length > 0);
  const unmatched = metrics.filter((metric) => !configured.has(metric.key));
  if (unmatched.length) sections.push({ title: "Additional operational metrics", description: "Additional measurements returned by the operational report.", metrics: unmatched, fallback: true });
  return sections;
}

const calculationLabels: Record<string, { numerator: string; denominator: string; formula: string }> = {
  research_completion_rate: { numerator: "Researched properties", denominator: "Discovered properties", formula: "Researched properties ÷ discovered properties × 100" },
  research_exception_rate: { numerator: "Properties with unresolved exceptions", denominator: "Discovered properties", formula: "Properties with unresolved exceptions ÷ discovered properties × 100" },
  buyer_closing_rate: { numerator: "Verified completed closings", denominator: "Completed plus failed closings", formula: "Verified completed closings ÷ measured closing outcomes × 100" },
  buyer_retrade_rate: { numerator: "Verified retrades", denominator: "Measured buyer responses", formula: "Verified retrades ÷ measured buyer responses × 100" },
  evidence_freshness: { numerator: "Fresh verified findings", denominator: "Research findings", formula: "Fresh verified findings ÷ research findings × 100" },
  outcome_reason_coverage: { numerator: "Final outcomes with a structured reason", denominator: "Final outcomes", formula: "Covered final outcomes ÷ final outcomes × 100" },
  seller_response_rate: { numerator: "Seller engagements reached", denominator: "Contact attempts", formula: "Seller engagements reached ÷ contact attempts × 100" },
  seller_contract_conversion_rate: { numerator: "Signed contracts", denominator: "Seller engagements reached", formula: "Signed contracts ÷ seller engagements reached × 100" },
  cost_per_seller_reached: { numerator: "Attributed costs", denominator: "Sellers reached", formula: "Attributed costs ÷ sellers reached" },
  cost_per_qualified_conversation: { numerator: "Attributed costs", denominator: "Qualified conversations", formula: "Attributed costs ÷ qualified conversations" },
  cost_per_offer: { numerator: "Attributed costs", denominator: "Offers prepared", formula: "Attributed costs ÷ offers prepared" },
  cost_per_contract: { numerator: "Attributed costs", denominator: "Signed contracts", formula: "Attributed costs ÷ signed contracts" },
  cost_per_closed_transaction: { numerator: "Attributed costs", denominator: "Closed transactions", formula: "Attributed costs ÷ closed transactions" },
};

export function metricCalculationDetails(metric: Metric) {
  const labels = calculationLabels[metric.key];
  return {
    definition: metric.definition,
    numerator: metric.numerator == null ? null : { label: labels?.numerator ?? "Numerator", value: formatOperationalValue(metric.numerator, metric.unit === "cents" ? "cents" : "count") },
    denominator: metric.denominator == null ? null : { label: labels?.denominator ?? "Denominator", value: formatOperationalValue(metric.denominator, "count") },
    formula: labels?.formula ?? null,
  };
}

export function formatOperationalValue(value: number | string | null, unit: Metric["unit"]) {
  if (value == null) return "Not enough data";
  if (unit === "cents") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) / 100);
  if (unit === "percent") return `${value}%`;
  if (unit === "hours") return `${value} hours`;
  return String(value);
}

export function parseOperationalReportFilters(entries: Iterable<[string, string]>): OperationalReportFilters {
  const allowed = new Set<keyof OperationalReportFilters>(["start", "end", "state", "county", "zip", "stage", "buyerId", "agentId", "propertyType", "leadSource", "transactionStructure"]);
  const filters: OperationalReportFilters = {};
  for (const [key, rawValue] of entries) {
    const value = rawValue.trim();
    if (value && allowed.has(key as keyof OperationalReportFilters)) filters[key as keyof OperationalReportFilters] = value;
  }
  return filters;
}

export function hasActiveOperationalFilters(filters: OperationalReportFilters) {
  return Object.values(filters).some((value) => Boolean(value));
}

export function operationalScopeParts(filters: OperationalReportFilters, windowStart?: string, windowEnd?: string) {
  const date = filters.start || filters.end
    ? `${filters.start || "Beginning"} to ${filters.end || "Today"}`
    : windowStart && windowEnd
      ? `${new Date(windowStart).toLocaleDateString("en-US")} to ${new Date(windowEnd).toLocaleDateString("en-US")}`
      : "Default 30-day window";
  const market = [filters.zip, filters.county, filters.state].filter(Boolean).join(", ") || "All markets";
  return [
    `Dates: ${date}`,
    `Market: ${market}`,
    `Stage: ${filters.stage || "All stages"}`,
    `Buyer: ${filters.buyerId || "All buyers"}`,
    `Agent: ${filters.agentId || "All agents"}`,
  ];
}
