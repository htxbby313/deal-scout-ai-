import "server-only";
import { resolveIntegrationEnvironment } from "@/lib/integration-env";

type SendInput = { channel: string; to: string; subject?: string | null; body: string; idempotencyKey: string };

export async function sendProviderMessage(input: SendInput) {
  if (input.channel === "EMAIL") {
    const { apiKey: key, from } = resolveIntegrationEnvironment().email;
    if (!key || !from) throw new Error("Resend email credentials or sender identity are missing.");
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify({ from, to: [input.to], subject: input.subject || "Property conversation", text: input.body }) });
    const result = await response.json() as { id?: string; message?: string };
    if (!response.ok || !result.id) throw new Error(result.message || "Resend rejected the email.");
    return { provider: "resend", reference: result.id };
  }
  if (input.channel === "SMS") {
    const { accountSid: sid, authToken: token, from } = resolveIntegrationEnvironment().sms;
    if (!sid || !token || !from) throw new Error("Twilio texting credentials or phone identity are missing.");
    const form = new URLSearchParams({ To: input.to, From: from, Body: input.body });
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": input.idempotencyKey }, body: form });
    const result = await response.json() as { sid?: string; message?: string };
    if (!response.ok || !result.sid) throw new Error(result.message || "Twilio rejected the text message.");
    return { provider: "twilio", reference: result.sid };
  }
  throw new Error(`No reviewed delivery adapter exists for ${input.channel}.`);
}
