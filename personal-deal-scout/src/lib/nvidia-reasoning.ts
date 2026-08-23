import "server-only";

import { z } from "zod";
import { fetchWithRetry } from "@/lib/research-runtime";

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-super-120b-a12b";

const analysisSchema = z.object({
  summary: z.string().trim().min(1).max(1_500),
  supportedObservations: z.array(z.string().trim().min(1).max(500)).max(12),
  missingEvidence: z.array(z.string().trim().min(1).max(500)).max(12),
  conflicts: z.array(z.string().trim().min(1).max(500)).max(12),
  recommendedInternalActions: z.array(z.string().trim().min(1).max(500)).max(12),
  confidence: z.number().int().min(0).max(100),
  authoritative: z.literal(false),
}).strict();

const responseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export type NvidiaEvidenceAnalysis = z.infer<typeof analysisSchema>;
export type NvidiaReasoningResult =
  | { status: "completed"; model: string; analysis: NvidiaEvidenceAnalysis }
  | { status: "unavailable"; reason: string };

export type NvidiaEvidenceInput = {
  propertyId: string;
  expectedBenefit?: string | null;
  expectedValueCents?: string | null;
  evidenceCount: number;
  materialRisks: string[];
  underwriting: unknown;
};

function safeEvidenceSnapshot(input: NvidiaEvidenceInput) {
  const serialized = JSON.stringify(input, (key, value) => {
    if (/secret|token|password|authorization|api.?key/i.test(key)) return "[REDACTED]";
    if (typeof value === "bigint") return value.toString();
    return value;
  });
  return serialized.length <= 12_000 ? serialized : `${serialized.slice(0, 12_000)}...[TRUNCATED]`;
}

function parseModelJson(content: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try { parsed = JSON.parse(trimmed); }
  catch { throw new Error("NVIDIA reasoning returned invalid structured output."); }
  const validated = analysisSchema.safeParse(parsed);
  if (!validated.success) throw new Error("NVIDIA reasoning returned unsupported analysis fields.");
  return validated.data;
}

export async function analyzeEvidenceWithNvidia(input: NvidiaEvidenceInput): Promise<NvidiaReasoningResult> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) return { status: "unavailable", reason: "NVIDIA reasoning is not configured." };
  const model = process.env.NVIDIA_REASONING_MODEL?.trim() || DEFAULT_MODEL;
  try {
    const response = await fetchWithRetry(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are Deal Scout's internal evidence analyst. Use only the supplied evidence. Never invent or upgrade a claim, provide a legal conclusion, authorize contact, alter financial values, predict guaranteed profit, or expose chain-of-thought. Return only JSON with exactly: summary, supportedObservations, missingEvidence, conflicts, recommendedInternalActions, confidence, authoritative. authoritative must be false. Recommendations must be reversible internal research or owner-review steps.",
          },
          { role: "user", content: safeEvidenceSnapshot(input) },
        ],
      }),
      attempts: 2,
      timeoutMs: 12_000,
      baseDelayMs: 300,
      minimumHostIntervalMs: 100,
    });
    if (!response.ok) return { status: "unavailable", reason: `NVIDIA reasoning returned HTTP ${response.status}.` };
    const raw = await response.text();
    if (new TextEncoder().encode(raw).length > 200_000) return { status: "unavailable", reason: "NVIDIA reasoning response exceeded the size limit." };
    const envelope = responseSchema.safeParse(JSON.parse(raw));
    if (!envelope.success) return { status: "unavailable", reason: "NVIDIA reasoning returned an invalid response envelope." };
    return { status: "completed", model, analysis: parseModelJson(envelope.data.choices[0].message.content) };
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error ? error.message : "NVIDIA reasoning failed safely." };
  }
}

export const __nvidiaReasoningTestables = { analysisSchema, safeEvidenceSnapshot, parseModelJson };
