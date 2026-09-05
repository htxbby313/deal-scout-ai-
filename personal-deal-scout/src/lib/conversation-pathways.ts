export const CONVERSATION_PATHWAYS = [
  {
    id: "SITE_ACQUISITION",
    label: "Site Acquisition",
    description: "Research and work the property as the asset, independent of seller or buyer disposition.",
  },
  {
    id: "SELLER_ACQUISITION",
    label: "Seller Acquisition",
    description: "Build the owner relationship around a specific property.",
  },
  {
    id: "DEVELOPER_BUYER_ACQUISITION",
    label: "Developer / Buyer Acquisition",
    description: "Build demand-side relationships and present opportunities when you choose.",
  },
] as const;

export type ConversationPathwayId = (typeof CONVERSATION_PATHWAYS)[number]["id"];

export function isConversationPathwayId(value: string): value is ConversationPathwayId {
  return CONVERSATION_PATHWAYS.some((pathway) => pathway.id === value);
}

export const defaultPathwayTemplates: Record<ConversationPathwayId, string> = {
  SITE_ACQUISITION:
    "Research [PROPERTY] and keep the opportunity moving with whatever property, contact, map, photo, and market context is currently available.",
  SELLER_ACQUISITION:
    "Hi [OWNER], I'm Tay with Coleman & Co. Holdings LLC. I wanted to ask about [PROPERTY]. Would you be open to talking about your plans for it?",
  DEVELOPER_BUYER_ACQUISITION:
    "Hi [CONTACT], I'm Tay with Coleman & Co. Holdings LLC. I'd like to understand the kinds of properties and opportunities your team looks for. Would you be open to a quick conversation?",
};
