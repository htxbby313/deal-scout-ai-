import { describe, expect, it } from "vitest";
import {
  evaluateAutonomousOutreach,
  messageFitsAuthorization,
  selectOutreachRecipient,
} from "./autonomous-outreach-policy";

const base = {
  authorizationStatus: "ACTIVE",
  startsAt: new Date("2026-09-01T00:00:00Z"),
  expiresAt: new Date("2026-10-01T00:00:00Z"),
  now: new Date("2026-09-10T12:00:00Z"),
  channel: "EMAIL",
  allowedChannels: ["EMAIL"],
  audience: "BOTH",
  targetAudience: "SELLER" as const,
  targetIdApproved: true,
  contentCompliant: true,
  recipientSuppressed: false,
  permissionGranted: true,
  providerReady: true,
  sentToday: 0,
  sentToRecipient: 0,
  followUpsToRecipient: 0,
  maximumMessagesPerDay: 10,
  maximumMessagesPerRecipient: 3,
  maximumFollowUpsPerRecipient: 2,
  isFollowUp: false,
  transactionActive: true,
};

describe("bounded autonomous outreach", () => {
  it("allows a message only inside an active approved envelope", () => {
    expect(evaluateAutonomousOutreach(base)).toEqual({
      allowed: true,
      blockers: [],
    });
  });

  it("fails closed on suppression, limits, permission, or a stopped transaction", () => {
    const result = evaluateAutonomousOutreach({
      ...base,
      recipientSuppressed: true,
      permissionGranted: false,
      sentToday: 10,
      transactionActive: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        "recipient_suppressed",
        "contact_permission_missing",
        "daily_limit_reached",
        "transaction_not_active",
      ]),
    );
  });

  it("enforces disclosures and prohibited claims", () => {
    expect(
      messageFitsAuthorization({
        body: "Hello. Reply STOP to opt out.",
        requiredDisclosure: "Reply STOP to opt out.",
        prohibitedClaims: ["guaranteed profit"],
      }),
    ).toBe(true);
    expect(
      messageFitsAuthorization({
        body: "Guaranteed profit. Reply STOP to opt out.",
        requiredDisclosure: "Reply STOP to opt out.",
        prohibitedClaims: ["guaranteed profit"],
      }),
    ).toBe(false);
    expect(
      messageFitsAuthorization({
        body: "We could offer $260,000. Reply STOP to opt out.",
        requiredDisclosure: "Reply STOP to opt out.",
        prohibitedClaims: [],
        sellerOfferCeilingCents: BigInt(25_000_000),
      }),
    ).toBe(false);
  });

  it("routes a buyer property message to the buyer, never the seller", () => {
    expect(
      selectOutreachRecipient({
        channel: "EMAIL",
        property: { contactEmail: "seller@example.com" },
        developer: { email: "buyer@example.com" },
      }),
    ).toBe("buyer@example.com");
  });
});
