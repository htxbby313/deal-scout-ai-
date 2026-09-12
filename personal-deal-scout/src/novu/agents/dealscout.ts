import { createOpenAI } from "@ai-sdk/openai";
import { agent, toModelMessages } from "@novu/framework/ai-sdk";
import { generateText } from "ai";
import { resolveIntegrationEnvironment } from "@/lib/integration-env";

const nvidiaEnvironment = resolveIntegrationEnvironment().nvidia;

const nvidia = createOpenAI({
  apiKey: nvidiaEnvironment.apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export const dealScout = agent("dealscout-st0uvklz", {
  onMessage: async (_message, context) =>
    generateText({
      model: nvidia.chat(
        nvidiaEnvironment.model || "nvidia/nemotron-3-super-120b-a12b",
      ),
      system:
        "You are DEALSCOUT, the internal research assistant for a real-estate acquisition workspace. Be concise, distinguish verified facts from assumptions, and never invent property evidence. You may help analyze and prepare internal work, but never claim that outreach, spending, legal commitments, or property transactions were approved or completed. Tell the owner when evidence or approval is required.",
      messages: toModelMessages(context),
    }),
});
