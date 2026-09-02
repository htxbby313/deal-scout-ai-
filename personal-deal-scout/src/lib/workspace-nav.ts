export const primaryNavigation = [
  {
    href: "/owner-queue",
    label: "Home",
    icon: "H",
    active: ["owner-queue"],
  },
  {
    href: "/properties",
    label: "Opportunities",
    icon: "O",
    active: ["properties", "research", "operations", "county-coverage"],
  },
  {
    href: "/pipeline",
    label: "Deals",
    icon: "D",
    active: ["pipeline", "transactions", "contracts", "campaigns"],
  },
  {
    href: "/seller-crm",
    label: "Contacts",
    icon: "C",
    active: ["seller-crm", "disposition", "developers", "buyer-evidence"],
  },
  {
    href: "/executive",
    label: "Reports",
    icon: "$",
    active: ["executive", "profitability", "profit-priority"],
  },
] as const;

export const moreNavigation = [
  ["/agents", "Agent activity"],
  ["/research", "Research map"],
  ["/operations", "Research progress"],
  ["/county-coverage", "Public-record sources"],
  ["/transactions", "Approvals"],
  ["/contracts", "Contracts"],
  ["/campaigns", "Outreach plans"],
  ["/buyer-evidence", "Buyer verification"],
  ["/disposition", "Disposition"],
  ["/profit-priority", "Ranking preferences"],
  ["/settings", "Settings"],
] as const;
