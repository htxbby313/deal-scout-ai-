import { describe, expect, it } from "vitest";
import { resolveIntegrationEnvironment } from "@/lib/integration-env";

describe("universal integration environment", () => {
  it("prefers current provider variables and supports common platform aliases", () => {
    const resolved = resolveIntegrationEnvironment({
      DATABASE_URL: "postgresql://legacy/db",
      POSTGRES_PRISMA_URL: "postgresql://current/db",
      POSTGRES_URL_NON_POOLING: "postgresql://current/direct",
      EMAIL_PROVIDER_API_KEY: "email-key",
      EMAIL_FROM_ADDRESS: "deals@example.com",
      NVIDIA_NIM_API_KEY: "nvidia-key",
      MIRRORFC_FIRECRAWL_API_KEY: "firecrawl-key",
      ENFORMION_USERNAME: "profile",
      ENFORMION_PASSWORD: "password",
      GOOGLE_MAPS_API_KEY: "maps-key",
      DEAL_SCOUT_WEBHOOK_SECRET: "webhook-secret",
    });

    expect(resolved.database).toEqual({ runtimeUrl: "postgresql://current/db", directUrl: "postgresql://current/direct" });
    expect(resolved.email).toEqual({ apiKey: "email-key", from: "deals@example.com" });
    expect(resolved.nvidia.apiKey).toBe("nvidia-key");
    expect(resolved.firecrawl.apiKey).toBe("firecrawl-key");
    expect(resolved.enformion).toEqual({ username: "profile", password: "password" });
    expect(resolved.googleMaps.serverApiKey).toBe("maps-key");
    expect(resolved.webhookSecret).toBe("webhook-secret");
  });

  it("ignores empty aliases instead of masking a configured fallback", () => {
    expect(resolveIntegrationEnvironment({ RESEND_API_KEY: " ", EMAIL_PROVIDER_API_KEY: "fallback" }).email.apiKey).toBe("fallback");
  });
});
