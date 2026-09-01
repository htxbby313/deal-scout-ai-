import { describe, expect, it } from "vitest";
import {
  humanLabel,
  sentenceCase,
  visibleStageFor,
  visibleStageLabel,
} from "@/lib/presentation";

describe("presentation labels", () => {
  it("groups detailed acquisition stages into six visible stages", () => {
    expect(visibleStageFor("DISCOVERED")).toBe("NEW_LEAD");
    expect(visibleStageFor("OUTREACH_READY")).toBe("QUALIFIED");
    expect(visibleStageFor("NURTURE")).toBe("CONTACTING");
    expect(visibleStageFor("OFFER_READY")).toBe("OFFER");
    expect(visibleStageFor("DISPOSITION_READY")).toBe("UNDER_CONTRACT");
    expect(visibleStageFor("CLOSED")).toBe("CLOSED");
  });

  it("keeps outcomes out of the everyday pipeline", () => {
    expect(visibleStageFor("DISQUALIFIED")).toBeNull();
    expect(visibleStageFor("ARCHIVED")).toBeNull();
  });

  it("returns acquisition-friendly labels instead of raw enums", () => {
    expect(humanLabel("UNDERWRITING_READY")).toBe("Offer");
    expect(humanLabel("PENDING_APPROVAL")).toBe("Needs approval");
    expect(humanLabel("NEEDS_MANUAL_VERIFICATION")).toBe("Needs review");
    expect(visibleStageLabel("UNDER_CONTRACT")).toBe("Under contract");
    expect(sentenceCase("PRIMARY_BUYER_MISSING")).toBe("Primary buyer missing");
  });
});

