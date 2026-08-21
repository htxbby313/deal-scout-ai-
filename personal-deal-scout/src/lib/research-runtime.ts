import { z } from "zod";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const sourceFailures = new Map<string, { count: number; openUntil: number }>();
const SCRIPT_STYLE_TAGS = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const HTML_TAGS = /<[^>]+>/g;
const WHITESPACE = /\s+/g;

export function normalizeText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim().replace(WHITESPACE, " ");
}

export function stableUnique<T>(values: Iterable<T>) {
  return [...new Set(values)];
}

export function stableUniqueBy<T>(values: Iterable<T>, key: (value: T) => string) {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const value of values) {
    const identity = key(value);
    if (seen.has(identity)) continue;
    seen.add(identity);
    unique.push(value);
  }
  return unique;
}

export function htmlToText(html: string) {
  return normalizeText(html.replace(SCRIPT_STYLE_TAGS, " ").replace(HTML_TAGS, " "));
}

export async function chunkedMap<T, R>(values: readonly T[], chunkSize: number, operation: (value: T, index: number) => Promise<R>) {
  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > 50) throw new Error("Chunk size must be an integer from 1 to 50.");
  const output: R[] = [];
  for (let offset = 0; offset < values.length; offset += chunkSize) {
    const chunk = values.slice(offset, offset + chunkSize);
    output.push(...await Promise.all(chunk.map((value, index) => operation(value, offset + index))));
  }
  return output;
}

type FetchRetryOptions = RequestInit & { attempts?: number; timeoutMs?: number; baseDelayMs?: number; sleep?: (delayMs: number) => Promise<void> };

export async function fetchWithRetry(input: URL | string, options: FetchRetryOptions = {}) {
  const { attempts = 3, timeoutMs = 15_000, baseDelayMs = 250, sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay)), ...init } = options;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 4) throw new Error("External request attempts must be between 1 and 4.");
  const host = new URL(input).hostname.toLowerCase();
  const circuit = sourceFailures.get(host);
  if (circuit && circuit.openUntil > Date.now()) throw new Error(`External source circuit is temporarily open for ${host}.`);
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) { sourceFailures.delete(host); return response; }
      if (!RETRYABLE_STATUS.has(response.status)) return response;
      if (attempt === attempts) { recordSourceFailure(host); return response; }
      lastError = new Error(`External source returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) { recordSourceFailure(host); throw error; }
    }
    await sleep(baseDelayMs * 2 ** (attempt - 1));
  }
  throw lastError instanceof Error ? lastError : new Error("External request failed.");
}

function recordSourceFailure(host: string) {
  const count = (sourceFailures.get(host)?.count ?? 0) + 1;
  sourceFailures.set(host, { count, openUntil: count >= 3 ? Date.now() + 60_000 : 0 });
}

export async function fetchValidatedJson<T>(input: URL | string, schema: z.ZodType<T>, options: FetchRetryOptions & { maxBytes?: number } = {}) {
  const { maxBytes = 2_000_000, ...fetchOptions } = options;
  const response = await fetchWithRetry(input, fetchOptions);
  if (!response.ok) throw new Error(`External source returned HTTP ${response.status}.`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error("External response exceeded the configured size limit.");
  const body = await response.text();
  if (new TextEncoder().encode(body).length > maxBytes) throw new Error("External response exceeded the configured size limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new Error("External source returned invalid JSON."); }
  const validated = schema.safeParse(parsed);
  if (!validated.success) throw new Error(`External response failed validation: ${validated.error.issues[0]?.message ?? "invalid data"}.`);
  return validated.data;
}

export const __researchRuntimeTestables = { RETRYABLE_STATUS, resetCircuits: () => sourceFailures.clear() };
