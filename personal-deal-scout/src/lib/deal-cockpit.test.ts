import { describe, expect, it } from "vitest";
import {
  acquisitionStageLabel,
  confidenceBand,
  DEAL_BOX_NO_CONVERSATION,
  DEAL_BOX_RECORD_EVIDENCE_COPY,
  DEAL_BOX_START_PURPOSE,
  dealBoxPrimaryCta,
  dealBoxThumbnailUrl,
  defaultDealSellerRecipient,
  isLostOrNurtureStage,
  offerVerdict,
  ownerQueueCtaLabel,
  sellerConversationHref,
  sellerFactsHref,
} from "@/lib/deal-cockpit";

describe("deal cockpit copy", () => {
  it("maps acquisition stages to seven customer labels without a second enum", () => {
    expect(acquisitionStageLabel("DISCOVERED")).toBe("New Lead");
    expect(acquisitionStageLabel("RESEARCHABLE")).toBe("Analyzing");
    expect(acquisitionStageLabel("BUYER_FIT")).toBe("Analyzing");
    expect(acquisitionStageLabel("UNDERWRITING_READY")).toBe("Analyzing");
    expect(acquisitionStageLabel("OFFER_READY")).toBe("Offer");
    expect(acquisitionStageLabel("CONTRACTED")).toBe("Contract");
    expect(acquisitionStageLabel("DISPOSITION_READY")).toBe("Disposition");
    expect(acquisitionStageLabel("DISQUALIFIED")).toBe("Lost");
    expect(acquisitionStageLabel("NURTURE")).toBe("Nurture");
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
    expect(sellerFactsHref("eng_1")).toBe(
      "/seller-crm?engagementId=eng_1#seller-intake",
    );
  });

  it("defaults Deal Box seller recipient and evidence copy without a Contacts hop", () => {
    expect(
      defaultDealSellerRecipient({
        contactPhone: " 3055550100 ",
        contactEmail: "owner@example.com",
        ownerName: "Pat Owner",
      }),
    ).toBe("3055550100");
    expect(
      defaultDealSellerRecipient({
        contactPhone: null,
        contactEmail: "owner@example.com",
        ownerName: "Pat Owner",
      }),
    ).toBe("owner@example.com");
    expect(
      defaultDealSellerRecipient({
        contactPhone: " ",
        contactEmail: null,
        ownerName: "Pat Owner",
      }),
    ).toBe("Pat Owner");
    expect(DEAL_BOX_START_PURPOSE).toBe("Seller relationship for this deal");
    expect(DEAL_BOX_NO_CONVERSATION).toBe(
      "No conversation recorded on this deal.",
    );
    expect(DEAL_BOX_RECORD_EVIDENCE_COPY).toBe(
      "Saves evidence; does not send.",
    );
  });

  it("keeps Lost and Nurture off the seven-column pipeline", () => {
    expect(isLostOrNurtureStage("DISQUALIFIED")).toBe(true);
    expect(isLostOrNurtureStage("NURTURE")).toBe(true);
    expect(isLostOrNurtureStage("OFFER_READY")).toBe(false);
  });

  it("names one primary Deal Box CTA from stage", () => {
    expect(dealBoxPrimaryCta({ stage: "DISCOVERED", propertyId: "p1" }).label).toBe(
      "Qualify",
    );
    expect(dealBoxPrimaryCta({ stage: "OFFER_READY", propertyId: "p1" })).toEqual({
      label: "Make Offer",
      href: "#numbers",
    });
    expect(
      dealBoxPrimaryCta({ stage: "CONTRACTED", propertyId: "p1" }).label,
    ).toBe("Send Contract");
  });

  it("only uses listing photos with displayable rights as the Deal Box thumbnail", () => {
    expect(
      dealBoxThumbnailUrl([
        {
          url: "https://cdn.example/restricted.jpg",
          kind: "LISTING_PHOTO",
          rightsStatus: "UNKNOWN",
          position: 0,
        },
        {
          url: "https://cdn.example/ok.jpg",
          kind: "LISTING_PHOTO",
          rightsStatus: "LICENSED",
          position: 1,
        },
      ]),
    ).toBe("https://cdn.example/ok.jpg");
    expect(
      dealBoxThumbnailUrl([
        {
          url: "https://cdn.example/map.png",
          kind: "MAP",
          rightsStatus: "OWNED",
          position: 0,
        },
      ]),
    ).toBeNull();
  });
});
