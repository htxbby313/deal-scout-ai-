import { sellerIntroduction } from "@/lib/conversation-voice";

export function planSellerConversationDraft(input: {
  address: string;
  contactName?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  email?: string | null;
  contactUrl?: string | null;
  sourceUrl?: string | null;
}) {
  const route =
    input.phone?.trim() || input.contactUrl?.trim() || input.sourceUrl?.trim();
  if (!route)
    return {
      ready: false as const,
      missing: ["public seller or broker contact route", "seller phone"],
    };

  const contactName = input.contactName?.trim();
  const ownerName = input.ownerName?.trim();
  const genericName = !contactName || contactName === "Research pending";
  const missing = [
    genericName && "contact name",
    !input.phone?.trim() && "seller phone",
    !input.email?.trim() && "email",
  ].filter(Boolean) as string[];
  const recipientLabel = genericName
    ? ownerName && ownerName !== "Research pending"
      ? ownerName
      : "Property contact"
    : contactName;

  return {
    ready: true as const,
    recipient: route,
    channel: input.phone?.trim() ? ("SMS" as const) : ("INTERNAL" as const),
    recipientLabel,
    missing,
    body: sellerIntroduction({ address: input.address, name: recipientLabel, hasPhone: Boolean(input.phone?.trim()) }),
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
