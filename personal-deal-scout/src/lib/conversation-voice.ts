// Recipient-facing copy only. Routing, evidence and approval rules stay in services.
export const senderName = "Tay";
export const companyName = "Coleman & Co. Holdings LLC";
export const conversationVoice = {
  version: 1,
  principles: [
    "Start with a genuine inquiry, not a sales pitch or a company-values speech.",
    "Use short, conversational sentences and one easy next question.",
    "Use only known facts; never invent familiarity, motivation, buying intent or urgency.",
    "Do not call us someone's acquisitions agent without an established relationship.",
    "Keep missing-data checklists and contact routes internal.",
    "Preserve required disclosures and approval controls verbatim.",
  ],
} as const;

export function greeting(name?: string | null) {
  const clean = name?.trim();
  return !clean || /^(unknown(?: owner)?|research pending|property contact|n\/a)$/i.test(clean)
    ? "Hi,"
    : `Hi ${clean},`;
}

export const sellerIntroductionTemplate =
  "Hi [OWNER], I'm Tay with Coleman & Co. Holdings LLC. I wanted to ask about [PROPERTY]. Would you be open to talking about your plans for it?";

const originalSellerIntroduction =
  "Hi [OWNER], I am researching the property at [PROPERTY]. Would you be open to a conversation?";

export function currentBuiltInTemplate(body: string) {
  // Exact match only: never rewrite owner-edited templates or their disclosures.
  return body === originalSellerIntroduction ? sellerIntroductionTemplate : body;
}

export function sellerIntroduction(input: { address: string; name?: string | null; hasPhone: boolean }) {
  return `${greeting(input.name)} I'm ${senderName} with ${companyName}. I wanted to ask about ${input.address}. ${input.hasPhone
    ? "Would you be open to talking about your plans for it?"
    : "Who would be the best person to speak with about it, and is there a number I could reach them on?"}`;
}

export function buyerIntroduction(name?: string | null) {
  return `${greeting(name)}\n\nI'm ${senderName} with ${companyName}. I'm reaching out to get to know a few buyers and learn what they're looking for.\n\nI spend my time researching properties, and I'd rather start with what you actually want to buy than guess and send you a list.\n\nWould you be open to a quick conversation about what a good opportunity looks like for your team?\n\nThanks,\n${senderName}\n${companyName}`;
}

// Exact legacy machine-copy shapes only; additions, disclosures and edits do not match.
export function refreshLegacyIntroduction(body: string): string | null {
  const seller = body.match(/^Hi ([^\n]+), this is Cole with Coleman & Co\. Holdings LLC\. I am reaching out about ([^\n]+)\. Would you be open to a brief conversation about the property and your plans for it\? There is no obligation\.(?: I would also like to confirm the best ((?:contact name|seller phone|email)(?: and (?:contact name|seller phone|email))*) for this conversation\.)?$/);
  if (seller) return sellerIntroduction({ name: seller[1], address: seller[2], hasPhone: !seller[3]?.includes("seller phone") });
  const buyer = body.match(/^Hello ([^\n]+),\n\nI’m Cole with Coleman & Co\. Holdings LLC\. We research off-market acquisition opportunities and would like to learn your current buy box before discussing any specific property\. Could you confirm your target markets, property types, price range, closing timeline, and the best acquisitions contact\?(?: We also need to confirm your (?:acquisitions contact name|business email|business phone)(?: and (?:acquisitions contact name|business email|business phone))*\.)?\n\nNo property is being offered in this message\. We will only present a specific opportunity after we hold the necessary contractual interest and the transaction is cleared for disposition\.\n\nContact route: [^\n]+$/);
  return buyer ? buyerIntroduction(buyer[1]) : null;
}

// Call only after the existing contract/disposition presentation gate passes.
export function propertyPackageInquiry(input: { name?: string | null; address: string; zipCode: string; lotSize?: string | null; yearBuilt?: string | null }) {
  const details = [
    `Address: ${input.address}`,
    `ZIP: ${input.zipCode}`,
    input.lotSize && `Lot size: ${input.lotSize}`,
    input.yearBuilt && `Year built: ${input.yearBuilt}`,
  ].filter(Boolean).join("\n");
  return `${greeting(input.name)}\n\nIt's ${senderName} with ${companyName}. Would you be interested in taking a look at ${input.address}?\n\n${companyName} holds a documented contractual interest in the property.\n\n${details}\n\nI can share the approved deal package if you'd like to see whether it fits what you're looking for.\n\nThanks,\n${senderName}\n${companyName}`;
}
