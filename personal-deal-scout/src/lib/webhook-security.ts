import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(body: string, supplied: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !supplied) return false;
  const normalized = supplied.startsWith("sha256=") ? supplied.slice(7) : supplied;
  if (!/^[a-f0-9]{64}$/i.test(normalized)) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(normalized.toLowerCase()), Buffer.from(expected));
}

export function webhookEvidence(body: string, eventId: string | null, provider: string | null) {
  return {
    payloadHash: createHash("sha256").update(body).digest("hex"),
    eventId: eventId?.slice(0, 200) || null,
    provider: provider?.slice(0, 100) || "unidentified",
    byteLength: Buffer.byteLength(body),
  };
}
