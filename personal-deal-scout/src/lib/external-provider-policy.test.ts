import { describe, expect, it } from "vitest";
import { evaluateExternalProviderRequest } from "@/lib/external-provider-policy";

describe("external provider request policy", () => {
  const now = new Date("2026-08-21T12:00:00.000Z");
  it("fails closed for disabled live access", () => expect(evaluateExternalProviderRequest({ status: "DISABLED", liveRequestsEnabled: false, deadlineAt: now.getTime() + 60_000, now })).toEqual({ allowed: false, blockers: ["provider_not_active", "live_requests_disabled"] }));
  it("blocks cooldowns, open circuits, exhausted quotas, and route shutdown margins", () => expect(evaluateExternalProviderRequest({ status: "ACTIVE", liveRequestsEnabled: true, nextEligibleAt: new Date(now.getTime() + 1), circuitOpenUntil: new Date(now.getTime() + 1), quotaRemaining: 0, deadlineAt: now.getTime() + 20_000, now }).blockers).toEqual(["cooldown_active", "circuit_open", "quota_exhausted", "insufficient_route_budget"]));
  it("allows only an active, budgeted, in-quota provider", () => expect(evaluateExternalProviderRequest({ status: "ACTIVE", liveRequestsEnabled: true, quotaRemaining: 1, deadlineAt: now.getTime() + 60_000, now }).allowed).toBe(true));
});
