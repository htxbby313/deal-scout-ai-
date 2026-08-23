export function planSellerConversationDraft(input: {
  address: string;
  contactName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  if (!input.phone?.trim())
    return { ready: false as const, missing: ["seller phone"] };

  const contactName = input.contactName?.trim();
  const ownerName = input.ownerName?.trim();
  const genericName = !contactName || contactName === "Research pending";
  const missing = [
    genericName && "contact name",
    !input.email?.trim() && "email",
  ].filter(Boolean) as string[];
  const recipientLabel = genericName
    ? ownerName && ownerName !== "Research pending"
      ? ownerName
      : "Property contact"
    : contactName;
  const request = missing.length
    ? ` I would also like to confirm the best ${missing.join(" and ")} for this conversation.`
    : "";

  return {
    ready: true as const,
    recipient: input.phone.trim(),
    recipientLabel,
    missing,
    body: `Hi ${recipientLabel}, this is Cole with Coleman & Co. Holdings LLC. I am reaching out about ${input.address}. Would you be open to a brief conversation about the property and your plans for it? There is no obligation.${request}`,
  };
}

export function planDeveloperConversationRoute(input: {
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  contactUrl?: string | null;
  website?: string | null;
}) {
  const route =
    input.email?.trim() ||
    input.contactUrl?.trim() ||
    input.phone?.trim() ||
    input.website?.trim();
  const missing = [
    !input.contactName?.trim() && "acquisitions contact name",
    !input.email?.trim() && "business email",
    !input.phone?.trim() && "business phone",
  ].filter(Boolean) as string[];
  return route
    ? {
        ready: true as const,
        route,
        channel: input.email?.trim()
          ? ("EMAIL" as const)
          : ("INTERNAL" as const),
        missing,
      }
    : { ready: false as const, missing: ["public contact route", ...missing] };
}
