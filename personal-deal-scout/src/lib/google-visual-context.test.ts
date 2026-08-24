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
});
