import { after, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { runAutomaticPropertyResearchBatch } from "@/lib/property-research";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  await requireOwner();
  const result = await runAutomaticPropertyResearchBatch(25);
  after(async () => {
    for (let batch = 0; batch < 20; batch += 1) {
      const next = await runAutomaticPropertyResearchBatch(25);
      if (next.processed === 0) break;
    }
  });
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
