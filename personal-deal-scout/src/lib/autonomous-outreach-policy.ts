export type AutonomousOutreachPolicyInput = {
  authorizationStatus: string;
  startsAt: Date;
  expiresAt: Date;
  now: Date;
  channel: string;
  allowedChannels: readonly string[];
  audience: string;
  targetAudience: "SELLER" | "BUYER";
  targetIdApproved: boolean;
  contentCompliant: boolean;
  recipientSuppressed: boolean;
  permissionGranted: boolean;
  providerReady: boolean;
  sentToday: number;
  sentToRecipient: number;
  followUpsToRecipient: number;
  maximumMessagesPerDay: number;
  maximumMessagesPerRecipient: number;
  maximumFollowUpsPerRecipient: number;
  isFollowUp: boolean;
  transactionActive: boolean;
};

export function evaluateAutonomousOutreach(
  input: AutonomousOutreachPolicyInput,
) {
  const blockers: string[] = [];
  if (input.authorizationStatus !== "ACTIVE")
    blockers.push("authorization_not_active");
  if (input.startsAt > input.now) blockers.push("authorization_not_started");
  if (input.expiresAt <= input.now) blockers.push("authorization_expired");
  if (!input.allowedChannels.includes(input.channel))
    blockers.push("channel_not_authorized");
  if (![input.targetAudience, "BOTH"].includes(input.audience))
    blockers.push("audience_not_authorized");
  if (!input.targetIdApproved) blockers.push("target_not_in_approved_snapshot");
  if (!input.contentCompliant)
    blockers.push("message_outside_approved_boundaries");
  if (input.recipientSuppressed) blockers.push("recipient_suppressed");
  if (!input.permissionGranted) blockers.push("contact_permission_missing");
  if (!input.providerReady) blockers.push("provider_not_ready");
  if (!input.transactionActive) blockers.push("transaction_not_active");
  if (input.sentToday >= input.maximumMessagesPerDay)
    blockers.push("daily_limit_reached");
  if (input.sentToRecipient >= input.maximumMessagesPerRecipient)
    blockers.push("recipient_limit_reached");
  if (
    input.isFollowUp &&
    input.followUpsToRecipient >= input.maximumFollowUpsPerRecipient
  )
    blockers.push("follow_up_limit_reached");
  return { allowed: blockers.length === 0, blockers };
}

export function messageFitsAuthorization(input: {
  body: string;
  requiredDisclosure?: string | null;
  prohibitedClaims: readonly string[];
  sellerOfferCeilingCents?: bigint | null;
}) {
  const body = input.body.toLocaleLowerCase();
  const disclosurePresent =
    !input.requiredDisclosure?.trim() ||
    body.includes(input.requiredDisclosure.trim().toLocaleLowerCase());
  const prohibitedClaimPresent = input.prohibitedClaims.some((claim) =>
    claim.trim() ? body.includes(claim.trim().toLocaleLowerCase()) : false,
  );
  const dollarAmounts = [
    ...input.body.matchAll(/\$\s*([0-9][0-9,]*(?:\.\d{1,2})?)/g),
  ].map((match) =>
    BigInt(Math.round(Number(match[1].replaceAll(",", "")) * 100)),
  );
  const ceilingRespected =
    input.sellerOfferCeilingCents == null ||
    dollarAmounts.every((amount) => amount <= input.sellerOfferCeilingCents!);
  return disclosurePresent && !prohibitedClaimPresent && ceilingRespected;
}

export function selectOutreachRecipient(input: {
  channel: string;
  developer?: { email?: string | null; phone?: string | null } | null;
  property?: {
    contactEmail?: string | null;
    contactPhone?: string | null;
  } | null;
}) {
  if (input.developer)
    return input.channel === "EMAIL"
      ? (input.developer.email ?? null)
      : input.channel === "SMS"
        ? (input.developer.phone ?? null)
        : null;
  return input.channel === "EMAIL"
    ? (input.property?.contactEmail ?? null)
    : input.channel === "SMS"
      ? (input.property?.contactPhone ?? null)
      : null;
}
