export function evaluateGoogleVisualContext(input: {
  enabled: boolean;
  browserKeyConfigured: boolean;
  serverKeyConfigured: boolean;
  serverFeaturesRequired?: boolean;
  serverApiRestrictionsVerified?: boolean;
  originRestrictionsVerified: boolean;
  apiRestrictionsVerified: boolean;
  quotasVerified: boolean;
  alertsVerified: boolean;
  attributionVerified: boolean;
  telemetryVerified: boolean;
  killSwitchVerified: boolean;
  ownerApprovedAt?: Date | null;
}) {
  const blockers = Object.entries({
    browser_key_missing: !input.browserKeyConfigured,
    server_key_missing:
      Boolean(input.serverFeaturesRequired) && !input.serverKeyConfigured,
    server_api_restrictions_unverified:
      Boolean(input.serverFeaturesRequired) &&
      !input.serverApiRestrictionsVerified,
    origin_restrictions_unverified: !input.originRestrictionsVerified,
    api_restrictions_unverified: !input.apiRestrictionsVerified,
    quotas_unverified: !input.quotasVerified,
    alerts_unverified: !input.alertsVerified,
    attribution_unverified: !input.attributionVerified,
    telemetry_unverified: !input.telemetryVerified,
    kill_switch_unverified: !input.killSwitchVerified,
    owner_approval_missing: !input.ownerApprovedAt,
  })
    .filter(([, blocked]) => blocked)
    .map(([code]) => code);
  return {
    allowed: input.enabled && blockers.length === 0,
    blockers: input.enabled ? blockers : ["provider_disabled", ...blockers],
    streetViewMetadataRequired: true,
    lazyLoadRequired: true,
    serverKeyClientExposureAllowed: false,
  };
}

export function evaluateGoogleVisualContextEnvironment(options?: {
  serverFeaturesRequired?: boolean;
}) {
  const ownerApprovedAt = process.env.GOOGLE_MAPS_OWNER_APPROVED_AT
    ? new Date(process.env.GOOGLE_MAPS_OWNER_APPROVED_AT)
    : null;
  const enabled = (name: string) => process.env[name] === "true";

  return evaluateGoogleVisualContext({
    enabled: enabled("GOOGLE_MAPS_ENABLED"),
    browserKeyConfigured: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    serverKeyConfigured: Boolean(process.env.GOOGLE_MAPS_SERVER_API_KEY),
    serverFeaturesRequired: options?.serverFeaturesRequired,
    serverApiRestrictionsVerified: enabled(
      "GOOGLE_MAPS_SERVER_API_RESTRICTIONS_VERIFIED",
    ),
    originRestrictionsVerified: enabled("GOOGLE_MAPS_ORIGIN_RESTRICTIONS_VERIFIED"),
    apiRestrictionsVerified: enabled("GOOGLE_MAPS_API_RESTRICTIONS_VERIFIED"),
    quotasVerified: enabled("GOOGLE_MAPS_QUOTAS_VERIFIED"),
    alertsVerified: enabled("GOOGLE_MAPS_BILLING_ALERTS_VERIFIED"),
    attributionVerified: enabled("GOOGLE_MAPS_ATTRIBUTION_VERIFIED"),
    telemetryVerified: enabled("GOOGLE_MAPS_TELEMETRY_VERIFIED"),
    killSwitchVerified: enabled("GOOGLE_MAPS_KILL_SWITCH_VERIFIED"),
    ownerApprovedAt:
      ownerApprovedAt && !Number.isNaN(ownerApprovedAt.getTime())
        ? ownerApprovedAt
        : null,
  });
}
