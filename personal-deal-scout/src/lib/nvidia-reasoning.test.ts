import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { analyzeEvidenceWithNvidia, __nvidiaReasoningTestables } from "@/lib/nvidia-reasoning";

const input = { propertyId: "property-1", expectedBenefit: "Owner review", expectedValueCents: "1500000", evidenceCount: 4, materialRisks: ["Title not confirmed"], underwriting: { ready: true } };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("NVIDIA evidence reasoning", () => {
  it("fails closed without a configured credential", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await expect(analyzeEvidenceWithNvidia(input)).resolves.toEqual({ status: "unavailable", reason: "NVIDIA reasoning is not configured." });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts only bounded, explicitly non-authoritative structured analysis", async () => {
    vi.stubEnv("NVIDIA_API_KEY", "test-only-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ summary: "Evidence supports owner review.", supportedObservations: ["Four evidence items are recorded."], missingEvidence: ["Title confirmation"], conflicts: [], recommendedInternalActions: ["Review title evidence."], confidence: 72, authoritative: false }) } }] }), { status: 200 })));
    const result = await analyzeEvidenceWithNvidia(input);
    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.analysis.authoritative).toBe(false);
      expect(result.analysis.confidence).toBe(72);
    }
  });

  it("rejects authoritative or extra model claims", () => {
    expect(() => __nvidiaReasoningTestables.parseModelJson(JSON.stringify({ summary: "Approve it", supportedObservations: [], missingEvidence: [], conflicts: [], recommendedInternalActions: [], confidence: 100, authoritative: true, sendNow: true }))).toThrow("unsupported analysis fields");
  });

  it("redacts secret-like fields and bounds the evidence payload", () => {
    const snapshot = __nvidiaReasoningTestables.safeEvidenceSnapshot({ ...input, underwriting: { apiKey: "do-not-send", notes: "x".repeat(20_000) } });
    expect(snapshot).not.toContain("do-not-send");
    expect(snapshot).toContain("[REDACTED]");
    expect(snapshot.length).toBeLessThanOrEqual(12_014);
  });
});
