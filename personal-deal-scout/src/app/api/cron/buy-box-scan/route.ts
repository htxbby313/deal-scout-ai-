import { scanActiveBuyBoxes } from "@/lib/buy-box-service";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const scan = await scanActiveBuyBoxes();
  return Response.json({
    ok: true,
    paidEnrichment: false,
    ...scan,
  });
}
