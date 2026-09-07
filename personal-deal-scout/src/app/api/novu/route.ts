import { serve } from "@novu/framework/next";
import { dealScout } from "@/novu/agents";

export const runtime = "nodejs";

export const { GET, POST, OPTIONS } = serve({
  agents: [dealScout],
});
