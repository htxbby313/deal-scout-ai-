type LogLevel = "info" | "warn" | "error";

function safeDetails(details?: Record<string, unknown>) {
  if (!details) return undefined;
  return Object.fromEntries(Object.entries(details).map(([key, value]) => {
    if (/token|secret|password|credential|authorization|cookie/i.test(key)) return [key, "[REDACTED]"];
    if (typeof value === "bigint") return [key, value.toString()];
    if (value instanceof Error) return [key, { name: value.name }];
    return [key, value];
  }));
}

export function logOperation(level: LogLevel, operation: string, details?: Record<string, unknown>) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, operation, details: safeDetails(details) });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export async function timedOperation<T>(operation: string, work: () => Promise<T>) {
  const startedAt = Date.now();
  logOperation("info", `${operation}_started`);
  try {
    const result = await work();
    logOperation("info", `${operation}_completed`, { durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    logOperation("error", `${operation}_failed`, { durationMs: Date.now() - startedAt, error });
    throw error;
  }
}
