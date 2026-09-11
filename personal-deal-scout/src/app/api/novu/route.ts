import { serve } from "@novu/framework/next";
import { dealScout } from "@/novu/agents";

export const runtime = "nodejs";

function handlers() { return serve({
  agents: [dealScout],
}); }

type NovuHandlers = ReturnType<typeof handlers>;
export const GET = (...args: Parameters<NovuHandlers["GET"]>) => handlers().GET(...args);
export const POST = (...args: Parameters<NovuHandlers["POST"]>) => handlers().POST(...args);
export const OPTIONS = (...args: Parameters<NovuHandlers["OPTIONS"]>) => handlers().OPTIONS(...args);
