import { describe, expect, it } from "vitest";
import { evaluateGoogleVisualContext } from "./google-visual-context";

describe("Google visual-context boundary", () => {
  it("stays disabled until every cost and security control is verified", () => {
    const result = evaluateGoogleVisualContext({
      enabled: false,
      browserKeyConfigured: true,
      serverKeyConfigured: true,
      originRestrictionsVerified: true,
      apiRestrictionsVerified: true,
      quotasVerified: false,
      alertsVerified: false,
      attributionVerified: true,
      telemetryVerified: false,
      killSwitchVerified: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("provider_disabled");
    expect(result.serverKeyClientExposureAllowed).toBe(false);
  });

  it("does not require an unused server key for the browser-only map", () => {
    const result = evaluateGoogleVisualContext({
      enabled: true,
      browserKeyConfigured: true,
      serverKeyConfigured: false,
      serverFeaturesRequired: false,
      originRestrictionsVerified: true,
      apiRestrictionsVerified: true,
      quotasVerified: true,
      alertsVerified: true,
      attributionVerified: true,
      telemetryVerified: true,
      killSwitchVerified: true,
      ownerApprovedAt: new Date("2026-08-31T00:00:00Z"),
    });

    expect(result.allowed).toBe(true);
    expect(result.blockers).not.toContain("server_key_missing");
  });

  it("still requires a server key before any server-side Maps feature is enabled", () => {
    const result = evaluateGoogleVisualContext({
      enabled: true,
      browserKeyConfigured: true,
      serverKeyConfigured: false,
      serverFeaturesRequired: true,
      serverApiRestrictionsVerified: true,
      originRestrictionsVerified: true,
      apiRestrictionsVerified: true,
      quotasVerified: true,
      alertsVerified: true,
      attributionVerified: true,
      telemetryVerified: true,
      killSwitchVerified: true,
      ownerApprovedAt: new Date("2026-08-31T00:00:00Z"),
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers).toContain("server_key_missing");
  });
});
