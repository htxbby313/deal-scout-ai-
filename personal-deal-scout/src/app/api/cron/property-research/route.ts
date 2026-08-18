import { runAutomaticPropertyResearchBatch } from "@/lib/property-research";

export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const result = await runAutomaticPropertyResearchBatch(2);
  return Response.json({ ok: true, ...result });
}
