export function evaluateGoogleVisualContext(input: {
  enabled: boolean;
  browserKeyConfigured: boolean;
  serverKeyConfigured: boolean;
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
    server_key_missing: !input.serverKeyConfigured,
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
