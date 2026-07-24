import { runFollowUpScheduler } from "@/lib/database";
import { ownerIsAuthenticated } from "@/lib/auth";

export async function POST() {
  if (!(await ownerIsAuthenticated())) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const result = await runFollowUpScheduler();
  return Response.json({ ok: true, ...result });
}
