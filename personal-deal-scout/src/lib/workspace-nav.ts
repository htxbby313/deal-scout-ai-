export const primaryNavigation = [
  { href: "/owner-queue", label: "Command Center", icon: "⌂", active: ["owner-queue"] },
  { href: "/deals", label: "Deals", icon: "◈", active: ["properties", "pipeline", "research", "operations", "county-coverage", "deals"] },
  { href: "/seller-crm", label: "People", icon: "○", active: ["seller-crm", "developers", "buyer-evidence", "disposition"] },
  { href: "/message-center", label: "Communications", icon: "□", active: ["message-center", "campaigns"] },
  { href: "/transactions", label: "Transactions", icon: "▣", active: ["transactions", "contracts", "title-companies"] },
] as const;

export const contextualNavigation = {
  deals: [{ href: "/opportunities", label: "Opportunities", active: ["deals"] }, { href: "/properties", label: "Properties", active: ["properties"] }, { href: "/pipeline", label: "Pipeline", active: ["pipeline", "operations", "county-coverage"] }, { href: "/research", label: "Map", active: ["research"] }],
  people: [{ href: "/seller-crm", label: "All Contacts", active: ["seller-crm"] }, { href: "/seller-crm?view=sellers", label: "Sellers", active: [] }, { href: "/developers", label: "Buyers & Developers", active: ["developers", "buyer-evidence", "disposition"] }],
  communications: [{ href: "/message-center", label: "Message Center", active: ["message-center"] }, { href: "/message-center?view=templates", label: "Templates", active: [] }, { href: "/seller-crm?view=activity", label: "Activity", active: ["campaigns"] }],
  transactions: [{ href: "/transactions", label: "Offers", active: ["transactions"] }, { href: "/contracts", label: "Contracts", active: ["contracts"] }, { href: "/disposition", label: "Assignments", active: [] }, { href: "/title-companies", label: "Title Companies", active: ["title-companies"] }, { href: "/transactions?view=closing", label: "Closing", active: [] }],
} as const;

export type ContextualGroup = keyof typeof contextualNavigation;

const contextualGroupBySection: Partial<Record<WorkspaceSection, ContextualGroup>> = {
  properties: "deals", pipeline: "deals", research: "deals", operations: "deals", "county-coverage": "deals", deals: "deals",
  "seller-crm": "people", developers: "people", "buyer-evidence": "people", disposition: "people",
  "message-center": "communications", campaigns: "communications",
  transactions: "transactions", contracts: "transactions", "title-companies": "transactions",
};

export function contextualGroupFor(section: WorkspaceSection) {
  return contextualGroupBySection[section] ?? null;
}

export const moreNavigation = [["/agents", "Agent activity"], ["/executive", "Reports"], ["/profitability", "Profitability"], ["/settings", "Settings"]] as const;
export type WorkspaceSection =
  | "owner-queue" | "governance" | "contracts" | "executive"
  | "profitability" | "profit-priority" | "campaigns" | "seller-crm"
  | "county-coverage" | "pipeline" | "agents" | "buyer-evidence"
  | "transactions" | "title-companies" | "operations" | "disposition"
  | "research" | "developers" | "properties" | "settings" | "deals"
  | "message-center";
