import { createHash } from "node:crypto";
import type { Metric } from "@/lib/operational-kpis";

function cell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeOperationalCsv(
  metrics: Metric[],
  filters: Record<string, string | undefined>,
  generatedAt: string,
  scope: readonly string[] = [],
) {
  const columns = [
    "key",
    "label",
    "definition",
    "value",
    "numerator",
    "denominator",
    "unit",
    "sampleSize",
    "windowStart",
    "windowEnd",
    "lastRefresh",
    "warning",
  ] as const;
  const metadata = `# Deal Scout operational KPI export generated ${generatedAt}; filters ${JSON.stringify(filters)}; scope ${JSON.stringify(scope)}`;
  const rows = metrics.map((metric) =>
    columns.map((column) => cell(metric[column])).join(","),
  );
  const csv = [metadata, columns.join(","), ...rows].join("\r\n") + "\r\n";
  return {
    csv,
    sha256: createHash("sha256").update(csv).digest("hex"),
    rowCount: metrics.length,
  };
}

export const __operationalCsvTestables = { cell };
