import { describe, expect, it } from "vitest";
import {
  acquisitionStageLabel,
  confidenceBand,
  offerVerdict,
  ownerQueueCtaLabel,
  sellerConversationHref,
} from "@/lib/deal-cockpit";

describe("deal cockpit copy", () => {
  it("maps acquisition stages to customer labels without a second enum", () => {
    expect(acquisitionStageLabel("DISCOVERED")).toBe("New Lead");
    expect(acquisitionStageLabel("RESEARCHABLE")).toBe("Researching");
    expect(acquisitionStageLabel("OFFER_READY")).toBe("Offer Sent");
    expect(acquisitionStageLabel("CONTRACTED")).toBe("Under Contract");
    expect(acquisitionStageLabel("DISPOSITION_READY", { matchCount: 2 })).toBe(
      "Buyer Matching",
    );
    expect(acquisitionStageLabel("DISPOSITION_READY", { matchCount: 0 })).toBe(
      "Disposition",
    );
    expect(acquisitionStageLabel("DISQUALIFIED")).toBe("Lost");
  });

  it("states offer/pass without requiring a percentage", () => {
    expect(
      offerVerdict({
        conflictCount: 1,
        sellerSafeMaximumCents: BigInt(1),
        projectedSpreadCents: BigInt(1),
      }),
    ).toBe("Insufficient verified data — do not offer yet");
    expect(
      offerVerdict({
        conflictCount: 0,
        sellerSafeMaximumCents: null,
        projectedSpreadCents: BigInt(1),
      }),
    ).toBe("Insufficient verified data — do not offer yet");
    expect(
      offerVerdict({
        conflictCount: 0,
        sellerSafeMaximumCents: BigInt(250_000_00),
        projectedSpreadCents: BigInt(12_000_00),
      }),
    ).toBe("Work this deal");
    expect(
      offerVerdict({
        conflictCount: 0,
        sellerSafeMaximumCents: BigInt(250_000_00),
        projectedSpreadCents: BigInt(0),
      }),
    ).toBe("Pass — projected spread does not support an offer");
  });

  it("reports confidence as solid, thin, or no data", () => {
    expect(confidenceBand(null, 0)).toBe("No data");
    expect(confidenceBand(73, 4)).toBe("Solid");
    expect(confidenceBand(40, 2)).toBe("Thin");
  });

  it("names Home queue actions and never dead-ends seller work", () => {
    expect(ownerQueueCtaLabel("SELLER_ENGAGEMENT")).toBe("Open seller");
    expect(ownerQueueCtaLabel("FUNNEL_BLOCKER")).toBe("Open deal");
    expect(sellerConversationHref({ engagementId: "eng_1" })).toBe(
      "/seller-crm?engagementId=eng_1",
    );
    expect(sellerConversationHref({ address: "123 Main St" })).toBe(
      "/seller-crm?q=123%20Main%20St",
    );
  });
});
