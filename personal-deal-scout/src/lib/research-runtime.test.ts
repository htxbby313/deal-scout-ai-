import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { __researchRuntimeTestables, chunkedMap, fetchValidatedJson, fetchWithRetry, htmlToText, normalizeText, stableUnique, stableUniqueBy } from "@/lib/research-runtime";

afterEach(() => { vi.unstubAllGlobals(); __researchRuntimeTestables.resetCircuits(); });

describe("research runtime", () => {
  it("runs sequential chunks while preserving input order", async () => {
    let active = 0; let maximum = 0;
    const result = await chunkedMap([1, 2, 3, 4, 5], 2, async (value) => { active += 1; maximum = Math.max(maximum, active); await Promise.resolve(); active -= 1; return value * 2; });
    expect(result).toEqual([2, 4, 6, 8, 10]);
    expect(maximum).toBe(2);
  });

  it("retries transient HTTP failures with bounded exponential delays", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const retryable = new Response("busy", { status: 503 });
    Object.defineProperty(retryable, "body", { value: { cancel } });
    const request = vi.fn().mockResolvedValueOnce(retryable).mockResolvedValue(new Response("ok", { status: 200 }));
    const delays: number[] = [];
    vi.stubGlobal("fetch", request);
    expect((await fetchWithRetry("https://example.gov", { minimumHostIntervalMs: 0, random: () => 0.5, sleep: async (delay) => { delays.push(delay); } })).status).toBe(200);
    expect(request).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(delays).toEqual([250]);
  });

  it("stops retries at the shared invocation deadline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));
    await expect(fetchWithRetry("https://example.gov", { deadlineAt: Date.now() + 1, minimumHostIntervalMs: 0, sleep: async () => undefined })).rejects.toThrow("time budget");
  });

  it("validates external JSON before returning it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response('{"count":2}', { status: 200, headers: { "content-type": "application/json" } })));
    await expect(fetchValidatedJson("https://example.gov", z.object({ count: z.number().int().positive() }))).resolves.toEqual({ count: 2 });
    await expect(fetchValidatedJson("https://example.gov", z.object({ count: z.string() }))).rejects.toThrow("failed validation");
  });

  it("normalizes text and removes duplicate values deterministically", () => {
    expect(normalizeText("  A\n  B ")).toBe("A B");
    expect(htmlToText("<style>x</style><p>One   two</p><script>bad()</script>")).toBe("One two");
    expect(stableUnique(["a", "a", "b"])).toEqual(["a", "b"]);
    expect(stableUniqueBy([{ id: "a", n: 1 }, { id: "a", n: 2 }], (value) => value.id)).toEqual([{ id: "a", n: 1 }]);
  });
});
