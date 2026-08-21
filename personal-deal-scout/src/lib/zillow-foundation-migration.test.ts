import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("prisma/migrations/20260821100000_zillow_market_foundation/migration.sql", "utf8");
const discoveryBoundary = readFileSync("src/lib/zillow-discovery.ts", "utf8");
const service = readFileSync("src/lib/zillow-market-service.ts", "utf8");

describe("Zillow market foundation migration", () => {
  it("is additive and keeps live providers fail-closed", () => {
    expect(migration).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE)\b/im);
    expect(migration).toContain('"status" "ExternalProviderStatus" NOT NULL DEFAULT \'DISABLED\'');
    expect(migration).toContain('"liveRequestsEnabled" BOOLEAN NOT NULL DEFAULT false');
    expect(migration).toContain('"verificationStatus" TEXT NOT NULL DEFAULT \'USER_OBSERVED_UNVERIFIED\'');
  });

  it("enforces dedupe, provider, and verification boundaries in the database", () => {
    expect(migration).toContain('PropertyDiscoveryReference_normalizedUrl_key');
    expect(migration).toContain('PropertyDiscoveryReference_provider_check');
    expect(migration).toContain('PropertyDiscoveryReference_verification_check');
  });

  it("does not implement a Zillow property-page fetch path", () => {
    expect(discoveryBoundary).not.toMatch(/\bfetch\s*\(/);
    expect(service).not.toMatch(/\bfetch\s*\(/);
  });
});
