export const systemMode = "RESEARCH" as const;

export type LeadStatus =
  | "NEW"
  | "VERIFYING"
  | "READY_TO_CONTACT"
  | "CONTACT_DAY_1"
  | "CONTACT_DAY_2"
  | "CONTACTED"
  | "INTAKE_RECEIVED"
  | "WAITING_ON_DEVELOPER"
  | "DEVELOPER_PRICE_RECEIVED"
  | "OFFER_DRAFTED"
  | "UNDER_CONTRACT"
  | "CLOSED"
  | "LONG_TERM_FOLLOW_UP";

export const neighborhoods = [
  {
    name: "Old Preston Hollow",
    city: "Dallas",
    zipCode: "75220",
    newBuildCount: 18,
    averageNewBuildPrice: 2850000,
    averageOriginalLotPrice: 1025000,
    developerActivityScore: 91,
    opportunityScore: 88,
  },
  {
    name: "West University",
    city: "Houston",
    zipCode: "77005",
    newBuildCount: 14,
    averageNewBuildPrice: 2420000,
    averageOriginalLotPrice: 910000,
    developerActivityScore: 83,
    opportunityScore: 81,
  },
  {
    name: "Zilker Edge",
    city: "Austin",
    zipCode: "78704",
    newBuildCount: 9,
    averageNewBuildPrice: 1990000,
    averageOriginalLotPrice: 765000,
    developerActivityScore: 72,
    opportunityScore: 74,
  },
];

export const developers = [
  {
    companyName: "ABC Custom Homes",
    contactName: "Maya Reeves",
    targetZipCodes: ["75220", "75225"],
    maximumPurchasePrice: 1900000,
    typicalBuildPrice: 6200000,
    responseSpeed: "Same day",
    active: true,
  },
  {
    companyName: "Northline Builders",
    contactName: "Daniel Price",
    targetZipCodes: ["75220", "77005"],
    maximumPurchasePrice: 1600000,
    typicalBuildPrice: 4100000,
    responseSpeed: "1-2 days",
    active: true,
  },
  {
    companyName: "Luxe Lot Partners",
    contactName: "Erin Stone",
    targetZipCodes: ["78704", "77005"],
    maximumPurchasePrice: 1400000,
    typicalBuildPrice: 3600000,
    responseSpeed: "2 days",
    active: true,
  },
  {
    companyName: "Infill House Co.",
    contactName: "Chris Morgan",
    targetZipCodes: ["75220"],
    maximumPurchasePrice: 1250000,
    typicalBuildPrice: 2800000,
    responseSpeed: "Slow",
    active: false,
  },
  {
    companyName: "Oakline Development",
    contactName: "Priya Shah",
    targetZipCodes: ["75220", "78704"],
    maximumPurchasePrice: 1750000,
    typicalBuildPrice: 5000000,
    responseSpeed: "Same day",
    active: true,
  },
];

export const leads = [
  {
    owner: "Sarah Johnson",
    property: "412 Oak Street",
    city: "Dallas",
    zipCode: "75220",
    status: "DEVELOPER_PRICE_RECEIVED" as LeadStatus,
    priority: "Urgent",
    motivationScore: 84,
    developerDemandScore: 92,
    opportunityScore: 91,
    estimatedDeveloperPrice: 1900000,
    estimatedSellerPrice: 1775000,
    estimatedAssignmentFee: 110000,
    confidenceScore: 78,
    nextActionType: "Call seller",
    nextActionAt: "Today 10:00 AM",
    reason: "Seller responded yesterday, matches 3 developer buy boxes, no follow-up scheduled.",
  },
  {
    owner: "James Carter",
    property: "88 Maple Avenue",
    city: "Dallas",
    zipCode: "75220",
    status: "WAITING_ON_DEVELOPER" as LeadStatus,
    priority: "High",
    motivationScore: 71,
    developerDemandScore: 87,
    opportunityScore: 82,
    estimatedDeveloperPrice: 1640000,
    estimatedSellerPrice: 1540000,
    estimatedAssignmentFee: 76000,
    confidenceScore: 69,
    nextActionType: "Record developer reply",
    nextActionAt: "Today 1:30 PM",
    reason: "Two developers asked for lot details and one response is due today.",
  },
  {
    owner: "Linda Park",
    property: "1907 Cedar Lane",
    city: "Houston",
    zipCode: "77005",
    status: "CONTACT_DAY_2" as LeadStatus,
    priority: "Medium",
    motivationScore: 52,
    developerDemandScore: 77,
    opportunityScore: 68,
    estimatedDeveloperPrice: 1125000,
    estimatedSellerPrice: 1060000,
    estimatedAssignmentFee: 48000,
    confidenceScore: 58,
    nextActionType: "Review SMS draft",
    nextActionAt: "Today 3:00 PM",
    reason: "Older property near four recent new builds; seller has not replied.",
  },
  {
    owner: "Rios Family Trust",
    property: "725 Barton Way",
    city: "Austin",
    zipCode: "78704",
    status: "INTAKE_RECEIVED" as LeadStatus,
    priority: "High",
    motivationScore: 79,
    developerDemandScore: 73,
    opportunityScore: 77,
    estimatedDeveloperPrice: 1325000,
    estimatedSellerPrice: 1210000,
    estimatedAssignmentFee: 90000,
    confidenceScore: 64,
    nextActionType: "Match developers",
    nextActionAt: "Tomorrow 9:00 AM",
    reason: "Intake is complete and the lot fits two active developers.",
  },
  {
    owner: "Mark Ellison",
    property: "51 Normandy Court",
    city: "Dallas",
    zipCode: "75225",
    status: "UNDER_CONTRACT" as LeadStatus,
    priority: "High",
    motivationScore: 88,
    developerDemandScore: 86,
    opportunityScore: 84,
    estimatedDeveloperPrice: 2100000,
    estimatedSellerPrice: 1960000,
    estimatedAssignmentFee: 118000,
    confidenceScore: 82,
    nextActionType: "Confirm buyer entity",
    nextActionAt: "Today 4:00 PM",
    reason: "Contract is signed and buyer confirmation is the bottleneck.",
  },
];

export const developerProjects = [
  { developer: "ABC Custom Homes", address: "390 Oak Street", originalPurchasePrice: 980000, newBuildSalePrice: 5750000 },
  { developer: "ABC Custom Homes", address: "421 Pinecrest Drive", originalPurchasePrice: 1060000, newBuildSalePrice: 6200000 },
  { developer: "Oakline Development", address: "6002 Royal Lane", originalPurchasePrice: 1180000, newBuildSalePrice: 5100000 },
  { developer: "Northline Builders", address: "77 Amherst Street", originalPurchasePrice: 870000, newBuildSalePrice: 3900000 },
  { developer: "Luxe Lot Partners", address: "1108 Bissonnet", originalPurchasePrice: 920000, newBuildSalePrice: 3425000 },
  { developer: "Luxe Lot Partners", address: "1711 Kinney Avenue", originalPurchasePrice: 760000, newBuildSalePrice: 3025000 },
  { developer: "Infill House Co.", address: "54 Azalea Lane", originalPurchasePrice: 810000, newBuildSalePrice: 2850000 },
  { developer: "Oakline Development", address: "806 Hether Street", originalPurchasePrice: 735000, newBuildSalePrice: 3650000 },
];

export const tasks = [
  { title: "Call Sarah Johnson", group: "Must Do Today", value: "Very High", due: "10:00 AM" },
  { title: "Record ABC Custom Homes price response", group: "Waiting on Replies", value: "High", due: "1:30 PM" },
  { title: "Review Linda Park Day 2 SMS draft", group: "High-Value Follow-Ups", value: "Medium", due: "3:00 PM" },
  { title: "Confirm buyer entity for Normandy Court", group: "Must Do Today", value: "Very High", due: "4:00 PM" },
  { title: "Add three new Preston Hollow teardown candidates", group: "Research Tasks", value: "Medium", due: "Tomorrow" },
];

export const messageDrafts = [
  {
    type: "Initial seller SMS",
    draft: "Hi Sarah, this is Cole. I was reviewing properties in your area and wanted to ask if you would consider a simple cash offer for 412 Oak Street. No pressure either way.",
  },
  {
    type: "Developer pricing request",
    draft: "I have a possible property in 75220. Lot is roughly 0.29 acres with several luxury new builds nearby. Where would you need to be on price if the seller is realistic?",
  },
  {
    type: "Offer follow-up",
    draft: "Wanted to follow up on the offer range we discussed. If the timing still works, I can walk through the next steps and keep everything subject to review.",
  },
];

export const metrics = {
  newOpportunities: 10,
  highPriorityLeads: 4,
  followUpsDue: 5,
  developerRepliesNeeded: 3,
  offersBeingWorked: 2,
  potentialAssignmentRevenue: 442000,
  dealsUnderContract: 1,
  closedRevenue: 65000,
};

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}
