import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature, webhookEvidence } from "@/lib/webhook-security";

describe("webhook verification", () => {
  it("accepts only the exact HMAC body signature", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const secret = "a-secure-webhook-secret-that-is-long-enough";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, `sha256=${signature}`, secret)).toBe(true);
    expect(verifyWebhookSignature(`${body} `, `sha256=${signature}`, secret)).toBe(false);
  });

  it("fails closed and stores only bounded evidence", () => {
    expect(verifyWebhookSignature("{}", null, undefined)).toBe(false);
    expect(webhookEvidence("{\"private\":true}", "event-1", "provider")).toEqual(expect.objectContaining({ eventId: "event-1", provider: "provider", byteLength: 16 }));
    expect(webhookEvidence("{\"private\":true}", "event-1", "provider")).not.toHaveProperty("private");
  });
});
