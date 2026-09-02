import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { runAutomaticPropertyResearchBatch } from "@/lib/property-research";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  await requireOwner();
  const result = await runAutomaticPropertyResearchBatch(25);
  const db = getPrisma();
  const [queued, running] = await Promise.all([
    db.propertyResearchRun.count({ where: { status: "QUEUED" } }),
    db.propertyResearchRun.count({ where: { status: "RUNNING" } }),
  ]);

  return NextResponse.json({
    processed: result.processed,
    completed: result.completed,
    failed: result.failed,
    remaining: queued + running,
  });
}
