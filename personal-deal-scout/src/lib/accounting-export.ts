import { createHash } from "node:crypto";

export type AccountingExportRow = {
  transactionId: string;
  settlementArtifactId: string;
  artifactHash: string;
  reviewer: string;
  reviewedAt: string;
  closingDate: string;
  sellerProceeds?: number;
  assignmentFee?: number;
  transactionCosts?: number;
  correctionCount: number;
};

const columns: Array<keyof AccountingExportRow> = ["transactionId", "settlementArtifactId", "artifactHash", "reviewer", "reviewedAt", "closingDate", "sellerProceeds", "assignmentFee", "transactionCosts", "correctionCount"];

function csvCell(value: unknown) {
  let text = value === undefined || value === null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
export function serializeAccountingCsv(rows: AccountingExportRow[], generatedAt = new Date()) {
  const metadata = ["exportSchemaVersion", "exportGeneratedAt", "sourceSystem", ...columns];
  const body = rows.map((row) => ["1", generatedAt.toISOString(), "Deal Scout reviewed settlement evidence", ...columns.map((column) => row[column])].map(csvCell).join(","));
  const csv = [metadata.join(","), ...body].join("\r\n") + "\r\n";
  return { csv, sha256: createHash("sha256").update(csv).digest("hex"), rowCount: rows.length, generatedAt: generatedAt.toISOString(), schemaVersion: 1 };
}

export const __accountingExportTestables = { csvCell };
