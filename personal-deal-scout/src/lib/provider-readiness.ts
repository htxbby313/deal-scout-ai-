import "server-only";
import type { EngagementChannel } from "@prisma/client";
import { evaluateProviderReadiness } from "@/lib/engagement-safety-policy";
import { getPrisma } from "@/lib/prisma";

export type ProviderReadinessProbe = {
  provider: string;
  channel: EngagementChannel;
  checkCredentials(): Promise<boolean>;
  checkWebhookVerification(): Promise<boolean>;
  checkSuppressionIntegration(): Promise<boolean>;
  checkAuditIntegration(): Promise<boolean>;
};

export async function assessProviderReadiness(probe: ProviderReadinessProbe) {
  const db = getPrisma();
  const current = await db.providerIntegrationReadiness.findUnique({ where: { provider_channel: { provider: probe.provider, channel: probe.channel } } });
  const [credentialsConfigured, webhookVerified, suppressionIntegrated, auditIntegrated] = await Promise.all([
    probe.checkCredentials(),
    probe.checkWebhookVerification(),
    probe.checkSuppressionIntegration(),
    probe.checkAuditIntegration(),
  ]);
  const ownerEnabled = current?.ownerEnabled ?? false;
  const result = evaluateProviderReadiness({ credentialsConfigured, webhookVerified, suppressionIntegrated, auditIntegrated, ownerEnabled });
  return db.providerIntegrationReadiness.upsert({
    where: { provider_channel: { provider: probe.provider, channel: probe.channel } },
    create: { provider: probe.provider, channel: probe.channel, credentialsConfigured, webhookVerified, suppressionIntegrated, auditIntegrated, ownerEnabled: false, status: "DISABLED", reviewedAt: new Date(), notes: "Readiness checks do not authorize outbound delivery." },
    update: { credentialsConfigured, webhookVerified, suppressionIntegrated, auditIntegrated, status: result.ready ? "READY" : ownerEnabled ? "REVIEW_NEEDED" : "DISABLED", reviewedAt: new Date(), notes: result.ready ? "Technical readiness recorded; every engagement still requires policy, consent, suppression, and owner gates." : `Missing readiness controls: ${result.missing.join(", ")}.` },
  });
}
