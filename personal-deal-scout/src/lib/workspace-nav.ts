export const primaryNavigation = [
  { href: "/owner-queue", label: "Command Center", icon: "⌂", active: ["owner-queue"] },
  { href: "/deals", label: "Deals", icon: "◈", active: ["properties", "pipeline", "research", "operations", "county-coverage", "deals"] },
  { href: "/seller-crm", label: "People", icon: "○", active: ["seller-crm", "developers", "buyer-evidence", "disposition"] },
  { href: "/message-center", label: "Communications", icon: "□", active: ["message-center", "campaigns"] },
  { href: "/transactions", label: "Transactions", icon: "▣", active: ["transactions", "contracts", "title-companies"] },
] as const;

export const contextualNavigation = {
  deals: [["/opportunities", "Opportunities"], ["/properties", "Properties"], ["/pipeline", "Pipeline"], ["/research", "Map"]],
  people: [["/seller-crm", "All Contacts"], ["/seller-crm?view=sellers", "Sellers"], ["/developers", "Buyers & Developers"]],
  communications: [["/message-center", "Message Center"], ["/message-center?view=templates", "Templates"], ["/seller-crm?view=activity", "Activity"]],
  transactions: [["/transactions", "Offers"], ["/contracts", "Contracts"], ["/disposition", "Assignments"], ["/title-companies", "Title Companies"], ["/transactions?view=closing", "Closing"]],
} as const;

export const moreNavigation = [["/agents", "Agent activity"], ["/executive", "Reports"], ["/profitability", "Profitability"], ["/settings", "Settings"]] as const;
