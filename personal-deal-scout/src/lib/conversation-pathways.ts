export const CONVERSATION_PATHWAYS = [
  {
    id: "SELLER_ACQUISITION",
    label: "Seller Acquisition",
    description:
      "Build the relationship with the owner or authorized property contact for a specific property you may want to acquire or contract.",
  },
  {
    id: "DEVELOPER_BUYER_ACQUISITION",
    label: "Developer Acquisition",
    description:
      "Build company-level relationships with developers, builders, housing acquisitions teams, and other buyers to learn and maintain their buy box.",
  },
] as const;

export type ConversationPathwayId = (typeof CONVERSATION_PATHWAYS)[number]["id"];

export function isConversationPathwayId(value: string): value is ConversationPathwayId {
  return CONVERSATION_PATHWAYS.some((pathway) => pathway.id === value);
}

export const defaultPathwayTemplates: Record<ConversationPathwayId, string> = {
  SELLER_ACQUISITION:
    "Hi [OWNER], I'm Tay with Coleman & Co. Holdings LLC. I wanted to ask about [PROPERTY]. Would you be open to talking about your plans for it?",
  DEVELOPER_BUYER_ACQUISITION:
    "Hi [CONTACT], I'm Tay with Coleman & Co. Holdings LLC. I'd like to get to know your acquisitions team and understand your current buy box, including the markets, property types, price ranges, and opportunities you are actively looking for. Would you be open to a quick conversation?",
};
