import { describe, expect, it } from "vitest";
import { explainDealScore, explainStoredDealScore } from "@/lib/deal-score";

const history = {
  totalScore: 72,
  projectedProfitScore: 40,
  probabilityScore: 55,
  sellerFitScore: 80,
  evidenceScore: 90,
  buyerCoverageScore: 75,
  velocityScore: 60,
  riskPenaltyScore: 20,
  reasons: ["evidence_ready", "buyer_coverage"],
  blockers: [] as string[],
  expiresAt: new Date("2026-09-01"),
};

const eligible = {
  stage: "BUYER_FIT",
  controlStatus: "ACTIVE",
  now: new Date("2026-08-19"),
};

describe("deal score explanation", () => {
  it("builds one wholesaler sentence from stored reasons and components", () => {
    expect(explainStoredDealScore(history)).toBe(
      "Score 72: buyer coverage and evidence are ready; projected spread is thin.",
    );
  });

  it("does not invent factors that are not in the stored reasons or components", () => {
    const sentence = explainStoredDealScore({
      ...history,
      reasons: ["buyer_coverage"],
      projectedProfitScore: 88,
    });
    expect(sentence).toBe("Score 72: buyer coverage is ready.");
    expect(sentence).not.toMatch(/AI/i);
    expect(sentence).not.toContain("velocity");
    expect(sentence).not.toContain("seller fit");
  });

  it("humanizes an unknown stored reason instead of dropping or fabricating a different factor", () => {
    expect(
      explainStoredDealScore({
        ...history,
        reasons: ["title_clear"],
        projectedProfitScore: 80,
      }),
    ).toBe("Score 72: title clear.");
  });

  it("shows Deal Score n when evaluateStoredProfitPriority leaves the score visible", () => {
    expect(explainDealScore({ history, ...eligible })).toEqual({
      displayScore: 72,
      label: "Deal Score 72",
      explanation:
        "Score 72: buyer coverage and evidence are ready; projected spread is thin.",
    });
  });

  it("returns a real zero only when the stored eligible score is zero", () => {
    const view = explainDealScore({
      history: { ...history, totalScore: 0, reasons: [], projectedProfitScore: 0 },
      ...eligible,
    });
    expect(view.displayScore).toBe(0);
    expect(view.label).toBe("Deal Score 0");
    expect(view.explanation).toBe("Score 0: projected spread is thin.");
  });

  it("omits the score entirely when there is no history — never a fake zero", () => {
    expect(explainDealScore({ history: null, ...eligible })).toEqual({
      displayScore: null,
      label: null,
      explanation: null,
    });
    expect(explainDealScore({ ...eligible })).toEqual({
      displayScore: null,
      label: null,
      explanation: null,
    });
  });

  it("hides the number and names the first blocker in plain English", () => {
    expect(
      explainDealScore({
        history: { ...history, blockers: ["evidence_incomplete"] },
        ...eligible,
      }),
    ).toEqual({
      displayScore: null,
      label: "Deal Score unavailable",
      explanation: "evidence is incomplete",
    });
  });

  it("hides stopped, inactive, and expired scores the same way evaluateStoredProfitPriority does", () => {
    expect(
      explainDealScore({
        history,
        ...eligible,
        controlStatus: "STOPPED",
      }).displayScore,
    ).toBeNull();
    expect(
      explainDealScore({
        history,
        ...eligible,
        stage: "ARCHIVED",
      }).explanation,
    ).toBe("this deal is inactive");
    expect(
      explainDealScore({
        history: { ...history, expiresAt: new Date("2026-08-01") },
        ...eligible,
      }).explanation,
    ).toBe("the score has expired");
  });
});
