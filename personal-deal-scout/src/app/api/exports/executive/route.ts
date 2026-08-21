import { NextRequest } from "next/server";
import { ownerIsAuthenticated } from "@/lib/auth";
import { serializeOperationalCsv } from "@/lib/operational-csv";
import { readOperationalReport, type OperationalReportFilters } from "@/lib/operational-report-service";
import { getPrisma } from "@/lib/prisma";
import { parseOperationalReportFilters } from "@/lib/operational-report-presentation";

export async function GET(request: NextRequest) {
  if (!(await ownerIsAuthenticated())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const filters: OperationalReportFilters = parseOperationalReportFilters(new URL(request.url).searchParams);
  const report = await readOperationalReport(filters);
  const result = serializeOperationalCsv(report.metrics, filters, report.generatedAt);
  await getPrisma().auditLog.create({ data: { type: "executive.kpi_exported", summary: `Exported ${result.rowCount} operational KPI rows.`, details: { sha256: result.sha256, rowCount: result.rowCount, filters, generatedAt: report.generatedAt } } });
  return new Response(result.csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="deal-scout-executive-${report.generatedAt.slice(0, 10)}.csv"`, "x-content-sha256": result.sha256, "cache-control": "private, no-store" } });
}
