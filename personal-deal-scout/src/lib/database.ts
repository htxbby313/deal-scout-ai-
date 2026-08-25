import "server-only";
import { planDeveloperConversationRoute } from "@/lib/conversation-drafting";

import { Prisma, type PrismaClient } from "@prisma/client";
import {
  PrismaClientKnownRequestError,
  type InputJsonValue,
} from "@prisma/client/runtime/library";
import { z } from "zod";

import { getPrisma } from "@/lib/prisma";
import { canSendOutbound, propertyReadiness } from "@/lib/domain";
import { evaluateLegacyOutboundBoundary } from "@/lib/legacy-outbound-boundary";
import { logOperation } from "@/lib/operational-logging";
import { developerRelationshipQualification } from "@/lib/developer-qualification";
import { evaluatePropertyPresentation } from "@/lib/property-presentation-policy";
import { routeForeclosure } from "@/lib/foreclosure-routing";

export type AuditType =
  | "database.migrated"
  | "property.created"
  | "lead.created"
  | "task.created"
  | "task.completed"
  | "message.template.created"
  | "message.draft.generated"
  | "message.approved"
  | "message.rejected"
  | "developer.created"
  | "developer.project.created"
  | "developer.matches.scored"
  | "developer.pricing_request.created"
  | "csv.foreclosure_imported"
  | "csv.developers_imported"
  | "csv.properties_imported"
  | "property.evidence_updated"
  | "property.retired"
  | "provider.blocked"
  | "webhook.received"
  | "scheduler.followups"
  | "research.census_permits"
  | "research.property_dossier"
  | "research.developer_dossier"
  | "property.media_added"
  | "property.media_reviewed";
export type ApprovalStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "SENT_BLOCKED";
export type QualificationStatus =
  "RESEARCH_NEEDED" | "LIMITED_CONTACT" | "QUALIFIED" | "PRIORITY" | "REJECTED";
export type OpportunityStatus =
  | "NEEDS_VERIFICATION"
  | "DEVELOPMENT_SIGNAL"
  | "CONFIRMED_AVAILABLE"
  | "GOVERNMENT_SALE"
  | "REJECTED";
export type PropertyResearchFindingRecord = {
  id: string;
  propertyId: string;
  topic: string;
  label: string;
  value?: string;
  status: "VERIFIED" | "NOT_FOUND" | "CONFLICT" | "NEEDS_MANUAL_VERIFICATION";
  sourceName?: string;
  sourceUrl?: string;
  observedAt: string;
  confidence: number;
  notes?: string;
};
export type PropertyMediaRecord = {
  id: string;
  propertyId: string;
  url: string;
  sourceUrl: string;
  sourceName: string;
  caption?: string;
  altText: string;
  kind: "LISTING_PHOTO" | "MAP" | "PARCEL" | "DOCUMENT" | "OTHER";
  position: number;
  sendApproved: boolean;
  rightsStatus: string;
  rightsEvidenceUrl?: string;
  externalApprovedAt?: string;
  discoveredAt: string;
  reviewedAt?: string;
};
export type PropertyResearchRunRecord = {
  id: string;
  propertyId: string;
  status: string;
  sourcesChecked: number;
  findingsFound: number;
  manualNeeded: number;
  error?: string;
  startedAt: string;
  finishedAt?: string;
};
export type PropertyRecord = {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName: string;
  county?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  marketFips?: string;
  propertyType?: string;
  yearBuilt?: string;
  lotSize?: string;
  estimatedValue?: number;
  notes?: string;
  opportunityStatus: OpportunityStatus;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactUrl?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceRecordDate?: string;
  verificationSourceUrl?: string;
  verificationDate?: string;
  lastVerifiedAt?: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  researchFindings: PropertyResearchFindingRecord[];
  media: PropertyMediaRecord[];
  researchRuns: PropertyResearchRunRecord[];
};
export type LeadRecord = {
  id: string;
  propertyId: string;
  ownerName: string;
  status: string;
  priority: string;
  nextActionType: string;
  nextActionAt: string;
  estimatedAssignmentFee: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
export type TaskRecord = {
  id: string;
  leadId: string;
  title: string;
  type: string;
  priority: string;
  status: "OPEN" | "DONE";
  dueAt: string;
  createdAt: string;
  updatedAt: string;
};
export type MessageTemplate = {
  id: string;
  type: string;
  channel: "SMS" | "EMAIL" | "VOICE" | "INTERNAL";
  body: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
export type MessageApproval = {
  id: string;
  leadId?: string;
  templateId?: string;
  channel: "SMS" | "EMAIL" | "VOICE" | "INTERNAL";
  recipientLabel: string;
  subject?: string;
  body: string;
  status: ApprovalStatus;
  provider: string;
  blockerCodes: string[];
  createdAt: string;
  updatedAt: string;
};
export type DeveloperRecord = {
  id: string;
  companyName: string;
  contactName?: string;
  phone?: string;
  email?: string;
  website?: string;
  contactUrl?: string;
  targetZipCodes: string[];
  maximumPurchasePrice?: number;
  typicalBuildPrice?: number;
  notes?: string;
  active: boolean;
  qualificationStatus: QualificationStatus;
  contactVerifiedAt?: string;
  lastResearchedAt?: string;
  researchRuns: Array<{
    id: string;
    status: string;
    sourcesChecked: number;
    findingsFound: number;
    manualNeeded: number;
    error?: string;
    startedAt: string;
    finishedAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
};
export type DeveloperProjectRecord = {
  id: string;
  developerId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  originalPurchasePrice?: number;
  newBuildSalePrice?: number;
  lotSquareFeet?: number;
  notes?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceRecordDate?: string;
  verifiedAt?: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
};
export type DeveloperMatch = {
  developerId: string;
  score: number;
  reasons: string[];
};
export type AuditLog = {
  id: string;
  type: AuditType;
  summary: string;
  details?: Record<string, unknown>;
  createdAt: string;
};
export type Database = {
  meta: {
    migrationVersion: number;
    systemMode: "RESEARCH" | "ACTIVE" | "PAUSED";
    smsProviderEnabled: boolean;
    emailProviderEnabled: boolean;
    voiceProviderEnabled: boolean;
    createdAt: string;
    updatedAt: string;
  };
  properties: PropertyRecord[];
  leads: LeadRecord[];
  tasks: TaskRecord[];
  developers: DeveloperRecord[];
  developerProjects: DeveloperProjectRecord[];
  messageTemplates: MessageTemplate[];
  messageApprovals: MessageApproval[];
  auditLogs: AuditLog[];
};

export const propertyInputSchema = z.object({
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().length(2),
  zipCode: z.string().min(5),
  ownerName: z.string().min(2),
  county: z.string().optional(),
  neighborhood: z.string().optional(),
  propertyType: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  marketFips: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  yearBuilt: z.string().optional(),
  lotSize: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  opportunityStatus: z
    .enum([
      "NEEDS_VERIFICATION",
      "DEVELOPMENT_SIGNAL",
      "CONFIRMED_AVAILABLE",
      "GOVERNMENT_SALE",
      "REJECTED",
    ])
    .optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  contactUrl: z.string().url().or(z.literal("")).optional(),
  sourceName: z.string().optional(),
  sourceUrl: z.string().url().or(z.literal("")).optional(),
  sourceRecordDate: z.string().optional(),
  confidence: z.coerce.number().min(0).max(100).optional(),
});
export const propertyEvidenceUpdateSchema = z.object({
  propertyId: z.string().min(1),
  estimatedValue: z.coerce.number().int().positive(),
  opportunityStatus: z.enum(["CONFIRMED_AVAILABLE", "GOVERNMENT_SALE"]),
  contactName: z.string().min(2),
  contactPhone: z
    .string()
    .regex(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/),
  contactEmail: z.string().email().or(z.literal("")).optional(),
  contactUrl: z.string().url().or(z.literal("")).optional(),
  verificationSourceUrl: z.string().url(),
  verificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.coerce.number().int().min(1).max(100),
  notes: z.string().optional(),
});
export const propertyRetirementSchema = z.object({
  propertyId: z.string().min(1),
  retirementReason: z.enum([
    "OFF_MARKET",
    "SOLD",
    "SOURCE_CONFLICT",
    "DUPLICATE",
    "OTHER",
  ]),
  verificationSourceUrl: z.string().url(),
  verificationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.coerce.number().int().min(1).max(100),
  notes: z.string().min(10),
});
export const leadInputSchema = z.object({
  propertyId: z.string().min(1),
  ownerName: z.string().min(2),
  status: z.string().min(2),
  priority: z.string().min(2),
  nextActionType: z.string().min(2),
  nextActionAt: z.string().min(2),
  estimatedAssignmentFee: z.coerce.number().min(0),
  notes: z.string().optional(),
});
export const templateInputSchema = z.object({
  type: z.string().min(2),
  channel: z.enum(["SMS", "EMAIL", "VOICE", "INTERNAL"]),
  body: z.string().min(10),
});
export const developerInputSchema = z.object({
  companyName: z.string().min(2),
  contactName: z.string().optional(),
  phone: z
    .string()
    .regex(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/)
    .or(z.literal(""))
    .optional(),
  email: z.string().email().or(z.literal("")).optional(),
  website: z.string().url().or(z.literal("")).optional(),
  contactUrl: z.string().url().or(z.literal("")).optional(),
  targetZipCodes: z.string().min(5),
  maximumPurchasePrice: z.coerce.number().min(0).optional(),
  typicalBuildPrice: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});
export const developerProjectInputSchema = z.object({
  developerId: z.string().min(1),
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().length(2),
  zipCode: z.string().min(5),
  originalPurchasePrice: z.coerce.number().min(0).optional(),
  newBuildSalePrice: z.coerce.number().min(0).optional(),
  lotSquareFeet: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  sourceName: z.string().min(2),
  sourceUrl: z.string().url(),
  sourceRecordDate: z.string().min(4),
  confidence: z.coerce.number().min(1).max(100),
});
export const foreclosureCsvImportSchema = z.object({
  csvText: z.string().min(10),
  sourceName: z.string().optional(),
});
export const crmCsvImportSchema = z.object({
  csvText: z.string().min(3),
  sourceName: z.string().optional(),
});

const iso = (value: Date) => value.toISOString();
const optional = <T>(value: T | null) => value ?? undefined;
function safeError(error: unknown, operation: string): never {
  logOperation("error", "database_operation_failed", { operation, error });
  if (error instanceof z.ZodError) throw error;
  if (
    error instanceof PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error("That record already exists.");
  }
  throw new Error(`Unable to ${operation}. Please try again.`);
}
async function audit(
  tx: Prisma.TransactionClient | PrismaClient,
  type: AuditType,
  summary: string,
  details?: Record<string, unknown>,
) {
  await tx.auditLog.create({
    data: { type, summary, details: details as InputJsonValue | undefined },
  });
}

function qualificationFor(
  developer: {
    phone: string | null;
    email: string | null;
    website?: string | null;
    contactName: string | null;
    contactUrl?: string | null;
  },
  verifiedProjects: number,
): QualificationStatus {
  void verifiedProjects; // Purchase history improves matching, not relationship eligibility.
  return developerRelationshipQualification(developer);
}

async function refreshDeveloperQualification(
  tx: Prisma.TransactionClient,
  developerId: string,
) {
  const developer = await tx.developer.findUniqueOrThrow({
    where: { id: developerId },
  });
  const verifiedProjects = await tx.developerProject.count({
    where: { developerId, sourceUrl: { not: null }, verifiedAt: { not: null } },
  });
  const qualificationStatus = qualificationFor(developer, verifiedProjects);
  return tx.developer.update({
    where: { id: developerId },
    data: { qualificationStatus, lastResearchedAt: new Date() },
  });
}

export async function readDatabase(): Promise<Database> {
  try {
    const db = getPrisma();
    const [setting, providers] = await db.$transaction(async (tx) => {
      const systemSetting = await tx.systemSetting.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton", mode: "RESEARCH" },
      });
      const providerSettings = [];
      for (const provider of ["SMS", "EMAIL", "VOICE"]) {
        providerSettings.push(
          await tx.providerSetting.upsert({
            where: { provider },
            update: {},
            create: { provider, enabled: false, configured: false },
          }),
        );
      }
      return [systemSetting, providerSettings] as const;
    });
    const [properties, leads, tasks] = await Promise.all([
      db.property.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          researchFindings: { orderBy: { topic: "asc" } },
          media: { orderBy: { position: "asc" } },
          researchRuns: { orderBy: { startedAt: "desc" }, take: 1 },
        },
      }),
      db.lead.findMany({ orderBy: { createdAt: "desc" } }),
      db.task.findMany({ orderBy: { createdAt: "desc" } }),
    ]);
    const [developers, developerProjects, templates] = await Promise.all([
      db.developer.findMany({
        orderBy: { createdAt: "desc" },
        include: { researchRuns: { orderBy: { startedAt: "desc" }, take: 1 } },
      }),
      db.developerProject.findMany({ orderBy: { createdAt: "desc" } }),
      db.messageTemplate.findMany({ orderBy: { createdAt: "desc" } }),
    ]);
    const [approvals, logs] = await Promise.all([
      db.messageApproval.findMany({ orderBy: { createdAt: "desc" } }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    const enabledProviders = new Map(
      providers.map((provider) => [provider.provider, provider.enabled]),
    );
    const enabled = (name: string) => enabledProviders.get(name) === true;
    return {
      meta: {
        migrationVersion: setting.migrationVersion,
        systemMode: setting.mode,
        smsProviderEnabled: enabled("SMS"),
        emailProviderEnabled: enabled("EMAIL"),
        voiceProviderEnabled: enabled("VOICE"),
        createdAt: iso(setting.createdAt),
        updatedAt: iso(setting.updatedAt),
      },
      properties: properties.map((p) => ({
        ...p,
        county: optional(p.county),
        neighborhood: optional(p.neighborhood),
        latitude: optional(p.latitude),
        longitude: optional(p.longitude),
        marketFips: optional(p.marketFips),
        opportunityStatus: p.opportunityStatus as OpportunityStatus,
        yearBuilt: optional(p.yearBuilt),
        lotSize: optional(p.lotSize),
        propertyType: optional(p.propertyType),
        estimatedValue: optional(p.estimatedValue),
        notes: optional(p.notes),
        contactName: optional(p.contactName),
        contactPhone: optional(p.contactPhone),
        contactEmail: optional(p.contactEmail),
        contactUrl: optional(p.contactUrl),
        sourceName: optional(p.sourceName),
        sourceUrl: optional(p.sourceUrl),
        sourceRecordDate: optional(p.sourceRecordDate),
        verificationSourceUrl: optional(p.verificationSourceUrl),
        verificationDate: optional(p.verificationDate),
        lastVerifiedAt: p.lastVerifiedAt ? iso(p.lastVerifiedAt) : undefined,
        researchFindings: p.researchFindings.map((f) => ({
          ...f,
          status: f.status as PropertyResearchFindingRecord["status"],
          value: optional(f.value),
          sourceName: optional(f.sourceName),
          sourceUrl: optional(f.sourceUrl),
          notes: optional(f.notes),
          observedAt: iso(f.observedAt),
        })),
        media: p.media.map((m) => ({
          ...m,
          kind: m.kind as PropertyMediaRecord["kind"],
          caption: optional(m.caption),
          rightsStatus: m.rightsStatus,
          rightsEvidenceUrl: optional(m.rightsEvidenceUrl),
          externalApprovedAt: m.externalApprovedAt
            ? iso(m.externalApprovedAt)
            : undefined,
          discoveredAt: iso(m.discoveredAt),
          reviewedAt: m.reviewedAt ? iso(m.reviewedAt) : undefined,
        })),
        researchRuns: p.researchRuns.map((r) => ({
          ...r,
          error: optional(r.error),
          startedAt: iso(r.startedAt),
          finishedAt: r.finishedAt ? iso(r.finishedAt) : undefined,
        })),
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      })),
      leads: leads.map((l) => ({
        ...l,
        notes: optional(l.notes),
        createdAt: iso(l.createdAt),
        updatedAt: iso(l.updatedAt),
      })),
      tasks: tasks.map((t) => ({
        ...t,
        status: t.status as "OPEN" | "DONE",
        createdAt: iso(t.createdAt),
        updatedAt: iso(t.updatedAt),
      })),
      developers: developers.map((d) => ({
        ...d,
        qualificationStatus: d.qualificationStatus as QualificationStatus,
        contactName: optional(d.contactName),
        phone: optional(d.phone),
        email: optional(d.email),
        website: optional(d.website),
        contactUrl: optional(d.contactUrl),
        maximumPurchasePrice: optional(d.maximumPurchasePrice),
        typicalBuildPrice: optional(d.typicalBuildPrice),
        notes: optional(d.notes),
        contactVerifiedAt: d.contactVerifiedAt
          ? iso(d.contactVerifiedAt)
          : undefined,
        lastResearchedAt: d.lastResearchedAt
          ? iso(d.lastResearchedAt)
          : undefined,
        researchRuns: d.researchRuns.map((run) => ({
          ...run,
          error: optional(run.error),
          startedAt: iso(run.startedAt),
          finishedAt: run.finishedAt ? iso(run.finishedAt) : undefined,
        })),
        createdAt: iso(d.createdAt),
        updatedAt: iso(d.updatedAt),
      })),
      developerProjects: developerProjects.map((p) => ({
        ...p,
        originalPurchasePrice: optional(p.originalPurchasePrice),
        newBuildSalePrice: optional(p.newBuildSalePrice),
        lotSquareFeet: optional(p.lotSquareFeet),
        notes: optional(p.notes),
        sourceName: optional(p.sourceName),
        sourceUrl: optional(p.sourceUrl),
        sourceRecordDate: optional(p.sourceRecordDate),
        verifiedAt: p.verifiedAt ? iso(p.verifiedAt) : undefined,
        createdAt: iso(p.createdAt),
        updatedAt: iso(p.updatedAt),
      })),
      messageTemplates: templates.map((t) => ({
        ...t,
        channel: t.channel as MessageTemplate["channel"],
        createdAt: iso(t.createdAt),
        updatedAt: iso(t.updatedAt),
      })),
      messageApprovals: approvals.map((a) => ({
        ...a,
        leadId: optional(a.leadId),
        templateId: optional(a.templateId),
        subject: optional(a.subject),
        channel: a.channel as MessageApproval["channel"],
        status: a.status as ApprovalStatus,
        createdAt: iso(a.createdAt),
        updatedAt: iso(a.updatedAt),
      })),
      auditLogs: logs.map((l) => ({
        id: l.id,
        type: l.type as AuditType,
        summary: l.summary,
        details: optional(l.details as Record<string, unknown> | null),
        createdAt: iso(l.createdAt),
      })),
    };
  } catch (error) {
    return safeError(error, "load Deal Scout data");
  }
}

export async function databaseInfo() {
  const db = await readDatabase();
  return {
    path: "PostgreSQL via Prisma",
    migrationVersion: db.meta.migrationVersion,
    systemMode: db.meta.systemMode,
  };
}

export async function createProperty(
  input: z.infer<typeof propertyInputSchema>,
) {
  try {
    const parsed = propertyInputSchema.parse(input);
    return await getPrisma().$transaction(async (tx) => {
      const property = await tx.property.create({
        data: { ...parsed, state: parsed.state.toUpperCase() },
      });
      await audit(
        tx,
        "property.created",
        `Created property ${property.address}.`,
        {
          propertyId: property.id,
          marketFips: property.marketFips,
          sourceUrl: property.sourceUrl,
        },
      );
      return property;
    });
  } catch (error) {
    return safeError(error, "create property");
  }
}

export async function updatePropertyEvidence(
  input: z.infer<typeof propertyEvidenceUpdateSchema>,
) {
  try {
    const parsed = propertyEvidenceUpdateSchema.parse(input);
    const { propertyId, ...evidence } = parsed;
    return await getPrisma().$transaction(async (tx) => {
      const existing = await tx.property.findUnique({
        where: { id: propertyId },
      });
      if (!existing || !existing.sourceUrl)
        throw new Error("Property and original source evidence are required.");
      const property = await tx.property.update({
        where: { id: propertyId },
        data: { ...evidence, lastVerifiedAt: new Date() },
      });
      const readiness = propertyReadiness(property);
      await audit(
        tx,
        "property.evidence_updated",
        `Updated price and contact evidence for ${property.address}.`,
        {
          propertyId,
          actionable: readiness.actionable,
          missing: readiness.missing,
          verificationSourceUrl: property.verificationSourceUrl,
          verificationDate: property.verificationDate,
        },
      );
      return property;
    });
  } catch (error) {
    return safeError(error, "update property evidence");
  }
}

export async function retireProperty(
  input: z.infer<typeof propertyRetirementSchema>,
) {
  try {
    const parsed = propertyRetirementSchema.parse(input);
    const { propertyId, retirementReason, ...evidence } = parsed;
    return await getPrisma().$transaction(async (tx) => {
      const existing = await tx.property.findUnique({
        where: { id: propertyId },
      });
      if (!existing || !existing.sourceUrl)
        throw new Error("Property and original source evidence are required.");
      const property = await tx.property.update({
        where: { id: propertyId },
        data: {
          opportunityStatus: "REJECTED",
          verificationSourceUrl: evidence.verificationSourceUrl,
          verificationDate: evidence.verificationDate,
          confidence: evidence.confidence,
          notes: evidence.notes,
          lastVerifiedAt: new Date(),
        },
      });
      await tx.developerMatch.deleteMany({ where: { propertyId } });
      await audit(
        tx,
        "property.retired",
        `Retired ${property.address} from the actionable pipeline.`,
        {
          propertyId,
          retirementReason,
          verificationSourceUrl: property.verificationSourceUrl,
          verificationDate: property.verificationDate,
        },
      );
      return property;
    });
  } catch (error) {
    return safeError(error, "retire property");
  }
}

export async function createLead(input: z.infer<typeof leadInputSchema>) {
  try {
    const parsed = leadInputSchema.parse(input);
    return await getPrisma().$transaction(async (tx) => {
      const lead = await tx.lead.create({ data: parsed });
      const task = await tx.task.create({
        data: {
          leadId: lead.id,
          title: lead.nextActionType,
          type: "NEXT_ACTION",
          priority: lead.priority,
          dueAt: lead.nextActionAt,
        },
      });
      await audit(tx, "lead.created", `Created lead for ${lead.ownerName}.`, {
        leadId: lead.id,
        propertyId: lead.propertyId,
      });
      await audit(
        tx,
        "task.created",
        `Created next-action task: ${task.title}.`,
        { taskId: task.id, leadId: lead.id },
      );
      return lead;
    });
  } catch (error) {
    return safeError(error, "create lead");
  }
}

export async function completeTask(taskId: string) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: taskId },
        data: { status: "DONE", completedAt: new Date() },
      });
      await audit(tx, "task.completed", `Completed task: ${task.title}.`, {
        taskId,
      });
      return task;
    });
  } catch (error) {
    return safeError(error, "complete task");
  }
}

export async function createMessageTemplate(
  input: z.infer<typeof templateInputSchema>,
) {
  try {
    const parsed = templateInputSchema.parse(input);
    return await getPrisma().$transaction(async (tx) => {
      const record = await tx.messageTemplate.create({ data: parsed });
      await audit(
        tx,
        "message.template.created",
        `Created ${record.channel} template: ${record.type}.`,
        { templateId: record.id },
      );
      return record;
    });
  } catch (error) {
    return safeError(error, "create message template");
  }
}
export async function createDeveloper(
  input: z.infer<typeof developerInputSchema>,
) {
  try {
    const p = developerInputSchema.parse(input);
    return await getPrisma().$transaction(async (tx) => {
      const record = await tx.developer.create({
        data: {
          ...p,
          targetZipCodes: p.targetZipCodes
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean),
        },
      });
      await audit(
        tx,
        "developer.created",
        `Created developer ${record.companyName}.`,
        { developerId: record.id },
      );
      return record;
    });
  } catch (error) {
    return safeError(error, "create developer");
  }
}
export async function createDeveloperProject(
  input: z.infer<typeof developerProjectInputSchema>,
) {
  try {
    const p = developerProjectInputSchema.parse(input);
    return await getPrisma().$transaction(async (tx) => {
      const record = await tx.developerProject.create({
        data: { ...p, state: p.state.toUpperCase(), verifiedAt: new Date() },
      });
      const developer = await refreshDeveloperQualification(tx, p.developerId);
      await audit(
        tx,
        "developer.project.created",
        `Recorded verified developer project ${record.address}.`,
        {
          developerId: record.developerId,
          projectId: record.id,
          qualificationStatus: developer.qualificationStatus,
          sourceUrl: record.sourceUrl,
        },
      );
      return record;
    });
  } catch (error) {
    return safeError(error, "create developer project");
  }
}

function calculateAllMatches(
  property: PropertyRecord,
  developers: DeveloperRecord[],
  projects: DeveloperProjectRecord[],
) {
  if (
    property.opportunityStatus === "REJECTED" ||
    !property.address ||
    !property.zipCode
  )
    return [];
  return developers
    .filter(
      (d) =>
        d.active &&
        d.qualificationStatus !== "REJECTED" &&
        Boolean(d.email || d.phone || d.contactUrl || d.website),
    )
    .filter((developer) => {
      const explicitMarketFit = developer.targetZipCodes.includes(
        property.zipCode,
      );
      const verifiedMarketFit = projects.some(
        (project) =>
          project.developerId === developer.id &&
          project.verifiedAt &&
          project.sourceUrl &&
          (project.zipCode === property.zipCode ||
            (project.city.toLowerCase() === property.city.toLowerCase() &&
              project.state === property.state)),
      );
      const statedMarketFit = statedDeveloperMarketFit(property, developer);
      const priceFits =
        !developer.maximumPurchasePrice ||
        !property.estimatedValue ||
        developer.maximumPurchasePrice >= property.estimatedValue;
      return (
        (explicitMarketFit || verifiedMarketFit || statedMarketFit.matched) &&
        priceFits
      );
    })
    .map((developer) => {
      let score = 10;
      const reasons: string[] = [
        "Public business contact route is available for relationship outreach.",
      ];
      if (["PRIORITY", "QUALIFIED"].includes(developer.qualificationStatus)) {
        score += 10;
        reasons.push("Existing research supports relationship readiness.");
      } else
        reasons.push(
          "Buy-box and capacity details should be confirmed in conversation.",
        );
      const history = projects.filter(
        (p) => p.developerId === developer.id && p.verifiedAt && p.sourceUrl,
      );
      if (developer.targetZipCodes.includes(property.zipCode)) {
        score += 35;
        reasons.push("Builds in the same ZIP code.");
      }
      const statedMarketFit = statedDeveloperMarketFit(property, developer);
      if (statedMarketFit.matched) {
        score += statedMarketFit.score;
        reasons.push(statedMarketFit.reason);
      }
      const cityCount = history.filter(
        (p) => p.city.toLowerCase() === property.city.toLowerCase(),
      ).length;
      if (cityCount) {
        score += Math.min(20, cityCount * 8);
        reasons.push(`Has ${cityCount} known project(s) in the same city.`);
      }
      if (
        developer.maximumPurchasePrice &&
        property.estimatedValue &&
        developer.maximumPurchasePrice >= property.estimatedValue
      ) {
        score += 15;
        reasons.push("Maximum purchase price can cover the estimated value.");
      } else if (developer.maximumPurchasePrice) {
        score += 8;
        reasons.push(
          "Known maximum purchase price is available for underwriting.",
        );
      }
      if (
        developer.typicalBuildPrice &&
        developer.typicalBuildPrice >= 3_000_000
      ) {
        score += 10;
        reasons.push("Typical build value supports high-end redevelopment.");
      }
      reasons.push(
        `${history.length} government-source ownership or development record${history.length === 1 ? "" : "s"} verified.`,
      );
      return {
        developerId: developer.id,
        score: Math.min(100, score),
        reasons,
      };
    })
    .sort(
      (a, b) => b.score - a.score || a.developerId.localeCompare(b.developerId),
    );
}

export function calculateMatches(
  property: PropertyRecord,
  developers: DeveloperRecord[],
  projects: DeveloperProjectRecord[],
) {
  return calculateAllMatches(property, developers, projects).slice(0, 5);
}

export function calculateDeveloperPropertyMatches(
  developerId: string,
  properties: PropertyRecord[],
  developers: DeveloperRecord[],
  projects: DeveloperProjectRecord[],
) {
  if (!developers.some((developer) => developer.id === developerId)) return [];

  return properties
    .flatMap((property) => {
      const match = calculateAllMatches(property, developers, projects).find(
        (candidate) => candidate.developerId === developerId,
      );
      return match ? [{ propertyId: property.id, ...match }] : [];
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.propertyId.localeCompare(b.propertyId),
    )
    .slice(0, 3);
}

function statedDeveloperMarketFit(
  property: Pick<PropertyRecord, "city" | "state" | "propertyType">,
  developer: Pick<DeveloperRecord, "notes">,
) {
  const criteria = (developer.notes ?? "")
    .split(/\r?\n/)
    .filter((line) =>
      /^(Acquisition criteria|Active acquisition signal|Property types):/i.test(
        line.trim(),
      ),
    )
    .join(" ")
    .toLowerCase();
  if (!criteria)
    return { matched: false, score: 0, reason: "No stated market fit." };

  const city = property.city.trim().toLowerCase();
  const state = property.state.trim().toLowerCase();
  const cityMatched = city.length > 2 && criteria.includes(city);
  const stateMatched = new RegExp(
    `(^|[^a-z])${state.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`,
    "i",
  ).test(criteria);
  const nationwide =
    /\b(nationwide|national|major us markets|major u\.s\. markets|across the (?:united states|us|u\.s\.))\b/i.test(
      criteria,
    );
  const propertyType = property.propertyType?.trim().toLowerCase();
  const typeMatched = Boolean(
    propertyType &&
    (criteria.includes(propertyType) ||
      (propertyType.includes("land") &&
        /\b(land|acre|development|ground-up)\b/i.test(criteria))),
  );

  if (cityMatched)
    return {
      matched: true,
      score: typeMatched ? 20 : 16,
      reason:
        "The imported acquisition criteria names this city; confirm the buy box in conversation.",
    };
  if (stateMatched)
    return {
      matched: true,
      score: typeMatched ? 15 : 11,
      reason:
        "The imported acquisition criteria names this state; confirm the buy box in conversation.",
    };
  if (nationwide)
    return {
      matched: true,
      score: typeMatched ? 8 : 4,
      reason:
        "The imported criteria states broad U.S. coverage; local appetite still needs confirmation.",
    };
  return { matched: false, score: 0, reason: "No stated market fit." };
}

export async function scoreDeveloperMatches(
  propertyId: string,
  writeAudit = true,
): Promise<DeveloperMatch[]> {
  try {
    const data = await readDatabase();
    const property = data.properties.find((p) => p.id === propertyId);
    if (!property) return [];
    const matches = calculateMatches(
      property,
      data.developers,
      data.developerProjects,
    );
    if (writeAudit)
      await getPrisma().$transaction(async (tx) => {
        for (const match of matches)
          await tx.developerMatch.upsert({
            where: {
              propertyId_developerId: {
                propertyId,
                developerId: match.developerId,
              },
            },
            update: { score: match.score, reasons: match.reasons },
            create: { propertyId, ...match },
          });
        await tx.developerMatch.deleteMany({
          where: {
            propertyId,
            developerId: { notIn: matches.map((match) => match.developerId) },
          },
        });
        await audit(
          tx,
          "developer.matches.scored",
          `Scored ${matches.length} developer match(es) for ${property.address}.`,
          { propertyId, topScore: matches[0]?.score ?? 0 },
        );
      });
    return matches;
  } catch (error) {
    return safeError(error, "score developer matches");
  }
}

export async function generateDraftApproval(
  templateId: string,
  leadId: string,
) {
  try {
    const db = getPrisma();
    const [template, lead] = await Promise.all([
      db.messageTemplate.findUnique({ where: { id: templateId } }),
      db.lead.findUnique({
        where: { id: leadId },
        include: { property: true },
      }),
    ]);
    if (!template || !lead) throw new Error("Template or lead not found.");
    const body = template.body
      .replaceAll("[OWNER]", lead.ownerName)
      .replaceAll("[PROPERTY]", lead.property.address)
      .replaceAll("[ZIP]", lead.property.zipCode);
    return await db.$transaction(async (tx) => {
      const approval = await tx.messageApproval.create({
        data: {
          leadId,
          templateId,
          channel: template.channel,
          recipientLabel: lead.ownerName,
          body,
          status: "PENDING",
          provider: "disabled",
        },
      });
      await audit(
        tx,
        "message.draft.generated",
        `Generated ${template.channel} draft for ${lead.ownerName}.`,
        { approvalId: approval.id, leadId },
      );
      return approval;
    });
  } catch (error) {
    return safeError(error, "generate message draft");
  }
}
export async function generateDeveloperRelationshipDraft(developerId: string) {
  const db = getPrisma();
  const developer = await db.developer.findUnique({
    where: { id: developerId },
  });
  if (!developer) throw new Error("Developer not found.");
  const plan = planDeveloperConversationRoute(developer);
  if (!plan.ready)
    throw new Error(
      `Developer contact research incomplete: ${plan.missing.join(", ")}.`,
    );
  const subject = `Acquisitions relationship: ${developer.companyName}`;
  const existing = await db.messageApproval.findFirst({
    where: {
      recipientLabel: developer.companyName,
      subject,
      status: { in: ["PENDING", "APPROVED", "SENT_BLOCKED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  const body = `Hello ${developer.contactName?.trim() || developer.companyName},\n\nI’m Cole with Coleman & Co. Holdings LLC. We research off-market acquisition opportunities and would like to learn your current buy box before discussing any specific property. Could you confirm your target markets, property types, price range, closing timeline, and the best acquisitions contact?${plan.missing.length ? ` We also need to confirm your ${plan.missing.join(" and ")}.` : ""}\n\nNo property is being offered in this message. We will only present a specific opportunity after we hold the necessary contractual interest and the transaction is cleared for disposition.\n\nContact route: ${plan.route}`;
  return db.$transaction(async (tx) => {
    const approval = await tx.messageApproval.create({
      data: {
        channel: plan.channel,
        recipientLabel: developer.companyName,
        subject,
        body,
        provider: "disabled",
      },
    });
    await audit(
      tx,
      "developer.pricing_request.created",
      `Generated relationship draft for ${developer.companyName}.`,
      {
        developerId,
        approvalId: approval.id,
        relationshipOnly: true,
        propertyPresented: false,
      },
    );
    return approval;
  });
}
export async function generateDeveloperPricingRequest(
  propertyId: string,
  developerId: string,
) {
  try {
    const db = getPrisma();
    const [property, developer, lead, transaction] = await Promise.all([
      db.property.findUnique({ where: { id: propertyId } }),
      db.developer.findUnique({ where: { id: developerId } }),
      db.lead.findUnique({ where: { propertyId } }),
      db.dealTransaction.findFirst({
        where: { propertyId, controlStatus: { not: "STOPPED" } },
        include: {
          documents: true,
          approvals: true,
          acquisitionFunnel: { include: { gates: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    if (!property || !developer)
      throw new Error("Property or developer not found.");
    const presentation = evaluatePropertyPresentation(transaction);
    if (!presentation.allowed)
      throw new Error(
        `Property presentation blocked: ${presentation.blockers.join(", ")}. Use a relationship-only conversation until every contract and disposition control is satisfied.`,
      );
    const subject = `Pricing request: ${property.address}`;
    const existing = await db.messageApproval.findFirst({
      where: {
        recipientLabel: developer.companyName,
        subject,
        status: { in: ["PENDING", "APPROVED", "SENT_BLOCKED"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;
    const matches = await scoreDeveloperMatches(propertyId, false);
    const match = matches.find((m) => m.developerId === developerId);
    const plan = planDeveloperConversationRoute(developer);
    if (!plan.ready)
      throw new Error(
        `Developer contact research incomplete: ${plan.missing.join(", ")}.`,
      );
    const body = `Coleman & Co. Holdings LLC holds a documented contractual interest in a property that fits your verified acquisition criteria.\n\nAddress: ${property.address}\nZIP: ${property.zipCode}\nLot size: ${property.lotSize || "unknown"}\nYear built: ${property.yearBuilt || "unknown"}\nFit evidence: ${(match?.reasons ?? []).join(" ") || "Verified buy-box fit."}\n\nWould you like to review the approved deal package and provide pricing feedback?${plan.missing.length ? ` Please also confirm your best ${plan.missing.join(" and ")} for future opportunities.` : ""}\n\nContact route: ${plan.route}`;
    return await db.$transaction(async (tx) => {
      const approval = await tx.messageApproval.create({
        data: {
          leadId: lead?.id,
          channel: plan.channel,
          recipientLabel: developer.companyName,
          subject,
          body,
          provider: "disabled",
        },
      });
      await audit(
        tx,
        "developer.pricing_request.created",
        `Generated pricing request for ${developer.companyName}.`,
        {
          developerId,
          propertyId,
          approvalId: approval.id,
          matchScore: match?.score,
          channel: plan.channel,
          contactRoute: plan.route,
        },
      );
      return approval;
    });
  } catch (error) {
    return safeError(error, "generate developer pricing request");
  }
}
export async function setApprovalStatus(
  approvalId: string,
  status: "APPROVED" | "REJECTED",
) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const approval = await tx.messageApproval.update({
        where: { id: approvalId },
        data: { status, blockerCodes: [] },
      });
      await audit(
        tx,
        status === "APPROVED" ? "message.approved" : "message.rejected",
        `${status === "APPROVED" ? "Approved" : "Rejected"} ${approval.channel} draft for ${approval.recipientLabel}.`,
        { approvalId },
      );
      return approval;
    });
  } catch (error) {
    return safeError(error, "update message approval");
  }
}

export async function attemptProviderSend(approvalId: string) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const approval = await tx.messageApproval.findUnique({
        where: { id: approvalId },
      });
      if (!approval) throw new Error("Approval not found.");
      const legacyBoundary = evaluateLegacyOutboundBoundary({
        approvalStatus: approval.status,
        transactionActive: false,
        suppressionClear: false,
        consentCurrent: false,
        stateProcedureCurrent: false,
        disclosurePresent: false,
        contactWindowVerified: false,
        providerReady: false,
        operationAllowed: false,
        adapterReviewed: false,
      });
      if (!legacyBoundary.allowed) {
        const blocked = await tx.messageApproval.update({
          where: { id: approvalId },
          data: {
            status: "SENT_BLOCKED",
            provider: "disabled",
            blockerCodes: legacyBoundary.blockers,
          },
        });
        await audit(
          tx,
          "provider.blocked",
          "Blocked legacy outbound draft; unified transaction, suppression, consent, procedure, disclosure, window, provider-operation, and reviewed-adapter gates are required.",
          { approvalId, blockers: legacyBoundary.blockers },
        );
        return blocked;
      }
      const setting = await tx.systemSetting.upsert({
        where: { id: "singleton" },
        update: {},
        create: { id: "singleton", mode: "RESEARCH" },
      });
      const provider = await tx.providerSetting.upsert({
        where: { provider: approval.channel },
        update: {},
        create: {
          provider: approval.channel,
          enabled: false,
          configured: false,
        },
      });
      const envConfigured = Boolean(
        process.env[`${approval.channel}_PROVIDER_API_KEY`],
      );
      if (
        !canSendOutbound({
          approvalStatus: approval.status,
          systemMode: setting.mode,
          providerEnabled: provider.enabled,
          providerConfigured: provider.configured,
          environmentConfigured: envConfigured,
        })
      ) {
        const blockerCodes = [
          approval.status !== "APPROVED" && "owner_approval_missing",
          setting.mode !== "ACTIVE" && "system_not_active",
          !provider.enabled && "provider_disabled",
          !provider.configured && "provider_not_configured",
          !envConfigured && "provider_credentials_missing",
        ].filter(Boolean) as string[];
        const blocked = await tx.messageApproval.update({
          where: { id: approvalId },
          data: { status: "SENT_BLOCKED", provider: "disabled", blockerCodes },
        });
        await audit(
          tx,
          "provider.blocked",
          `Blocked outbound ${approval.channel}; approval, ACTIVE mode, enabled provider, and verified configuration are required.`,
          { approvalId, systemMode: setting.mode, blockers: blockerCodes },
        );
        return blocked;
      }
      // No provider adapter is selected. Fail closed until a real, reviewed adapter exists.
      await audit(
        tx,
        "provider.blocked",
        `Blocked outbound ${approval.channel}; no provider adapter is configured.`,
        { approvalId },
      );
      return tx.messageApproval.update({
        where: { id: approvalId },
        data: {
          status: "SENT_BLOCKED",
          blockerCodes: ["provider_adapter_missing"],
        },
      });
    });
  } catch (error) {
    return safeError(error, "process outbound message");
  }
}

export async function runFollowUpScheduler() {
  try {
    const db = getPrisma();
    const leads = await db.lead.findMany({ take: 10 });
    let created = 0;
    await db.$transaction(async (tx) => {
      for (const lead of leads) {
        const title = `Follow up: ${lead.nextActionType}`;
        const exists = await tx.task.findUnique({
          where: { leadId_title: { leadId: lead.id, title } },
        });
        if (!exists) {
          await tx.task.create({
            data: {
              leadId: lead.id,
              title,
              type: "SCHEDULED_FOLLOW_UP",
              priority: lead.priority,
              dueAt: lead.nextActionAt,
            },
          });
          created += 1;
        }
      }
      await audit(
        tx,
        "scheduler.followups",
        `Follow-up scheduler created ${created} task(s).`,
        { created },
      );
    });
    return { created };
  } catch (error) {
    return safeError(error, "run follow-up scheduler");
  }
}
export async function recordWebhook(
  type: "message" | "call",
  evidence: {
    payloadHash: string;
    eventId: string | null;
    provider: string;
    byteLength: number;
  },
) {
  if (!evidence.eventId)
    throw new Error("A stable webhook event ID is required for idempotency.");
  const db = getPrisma();
  try {
    await db.$transaction(async (tx) => {
      await tx.providerWebhookReceipt.create({
        data: {
          provider: evidence.provider,
          channel: type === "message" ? "SMS" : "PHONE",
          externalEventId: evidence.eventId!,
          payloadHash: evidence.payloadHash,
          byteLength: evidence.byteLength,
        },
      });
      await audit(
        tx,
        "webhook.received",
        `Received verified ${type} webhook.`,
        evidence,
      );
    });
    return { duplicate: false };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { duplicate: true };
    return safeError(error, "record webhook");
  }
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function parseCsvRows(csvText: string) {
  const lines = csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim());
  const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim());
  if (!headers.length || headers.every((header) => !header))
    throw new Error("The CSV needs a header row.");
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries([
      ...headers.map((header, index) => [header, values[index] ?? ""]),
      ...values
        .slice(headers.length)
        .map((value, index) => [`__extra_${index}`, value]),
    ]);
  });
}

function csvValue(row: Record<string, string>, ...headers: string[]) {
  for (const header of headers) {
    const direct = row[header]?.trim();
    if (direct) return direct;
    const match = Object.entries(row).find(
      ([key, value]) =>
        key.trim().toLowerCase() === header.toLowerCase() && value.trim(),
    );
    if (match) return match[1].trim();
  }
  return "";
}

function csvNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round(parsed)
    : undefined;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : "";
}
function validPhone(value: string) {
  return /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(value)
    ? value
    : "";
}
function validUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : "";
}

function csvFlag(value: string) {
  return /^(?:1|true|yes|y)$/i.test(value.trim());
}

function propertyCsvLocation(row: Record<string, string>) {
  const address = csvValue(
    row,
    "Street Address",
    "Property Address",
    "Address",
    "Property_Street_Address",
    "Formated_Address",
    "Formatted_Address",
  );
  const city = csvValue(row, "City", "Property_City");
  const state = csvValue(row, "State", "Property_State").toUpperCase();
  const zipCode = csvValue(
    row,
    "Zip Code",
    "ZIP Code",
    "Zip",
    "ZIP",
    "Property_Zip_Code",
  );
  return address && city && state.length === 2 && zipCode.length >= 5
    ? { address, city, state, zipCode }
    : null;
}

function noteLines(entries: Array<[string, string]>) {
  return (
    entries
      .filter(([, value]) => value)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n") || undefined
  );
}

function normalizeDeveloperRow(row: Record<string, string>) {
  const uploadedFormat =
    "Company" in row && "Acquisition_Criteria_Summary" in row;
  if (!uploadedFormat)
    return {
      companyName: csvValue(
        row,
        "Company Name",
        "Company",
        "Developer Name",
        "Developer",
        "Buyer Name",
        "Buyer",
      ),
      contactName: csvValue(row, "Contact Name", "Acquisitions Contact"),
      phone: csvValue(row, "Phone", "Phone Number"),
      email: csvValue(row, "Email", "Email Address"),
      website: csvValue(row, "Website", "URL"),
      targetMarkets: csvValue(row, "Target Markets", "Markets", "Market"),
      propertyTypes: csvValue(
        row,
        "Property Types",
        "Property Type",
        "Asset Types",
        "Asset Type",
      ),
      acquisitionCriteria: csvValue(
        row,
        "Acquisition Criteria",
        "Acquisition Criteria Summary",
        "Buy Box",
      ),
      activeSignal: csvValue(row, "Actively Seeking", "Active Buying Signal"),
      source: csvValue(row, "Buy Box Source", "Source", "Source URL"),
    };

  const malformed = Object.keys(row).some((key) => key.startsWith("__extra_"));
  const tail = Object.values(row)
    .slice(4)
    .filter((value) => value.trim());
  const isUrl = (value: string) =>
    /^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(value);
  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const isPhone = (value: string) =>
    /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/.test(value);
  const classified = tail.map((value) => ({
    value,
    url: isUrl(value),
    email: isEmail(value),
    phone: isPhone(value),
  }));
  const urls = classified.filter((item) => item.url).map((item) => item.value);
  const firstUrl = classified.findIndex((item) => item.url);
  const narrative = (firstUrl >= 0 ? classified.slice(0, firstUrl) : classified)
    .filter((item) => !item.email && !item.phone)
    .map((item) => item.value);
  const website = urls.find((value) => !/linkedin\.com/i.test(value)) ?? "";
  const source =
    [...urls].reverse().find((value) => value !== website) ?? website;
  const contact =
    classified.find(
      (item) =>
        /\b(founder|principal|acquisitions|director|president|owner|ceo)\b/i.test(
          item.value,
        ) && !item.url,
    )?.value ?? "";
  return {
    companyName: row.Company?.trim() ?? "",
    contactName: malformed ? contact : csvValue(row, "Contact_Person"),
    phone: malformed
      ? (classified.find((item) => item.phone)?.value ?? "")
      : csvValue(row, "Phone"),
    email: malformed
      ? (classified.find((item) => item.email)?.value ?? "")
      : csvValue(row, "Email"),
    website: malformed ? website : csvValue(row, "Website"),
    targetMarkets: [row.HQ_City, row.HQ_State].filter(Boolean).join(", "),
    propertyTypes: row.Asset_Class_Focus?.trim() ?? "",
    acquisitionCriteria: malformed
      ? narrative.join(", ")
      : csvValue(row, "Acquisition_Criteria_Summary"),
    activeSignal: malformed ? "" : csvValue(row, "Actively_Seeking"),
    source: malformed ? source : csvValue(row, "Source"),
  };
}

export async function importDevelopersCsv(
  input: z.infer<typeof crmCsvImportSchema>,
) {
  const parsed = crmCsvImportSchema.parse(input);
  const rows = parseCsvRows(parsed.csvText);
  let created = 0;
  let skipped = 0;
  const createdIds: string[] = [];
  await getPrisma().$transaction(async (tx) => {
    for (const row of rows) {
      const normalized = normalizeDeveloperRow(row);
      const companyName = normalized.companyName;
      if (!companyName) {
        skipped += 1;
        continue;
      }
      const existing = await tx.developer.findUnique({
        where: { companyName },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      const targetZipCodes = csvValue(
        row,
        "Target ZIP Codes",
        "Target ZIPs",
        "ZIP Codes",
        "ZIPs",
        "Zip Code",
        "ZIP",
      )
        .split(/[;,]/)
        .map((zip) => zip.trim())
        .filter(Boolean);
      const developer = await tx.developer.create({
        data: {
          companyName,
          contactName: normalized.contactName || undefined,
          phone: validPhone(normalized.phone) || undefined,
          email: validEmail(normalized.email) || undefined,
          website: normalized.website || undefined,
          targetZipCodes: targetZipCodes.length ? targetZipCodes : ["Unknown"],
          maximumPurchasePrice: csvNumber(
            csvValue(
              row,
              "Maximum Purchase Price",
              "Max Purchase Price",
              "Maximum Price",
              "Max Price",
            ),
          ),
          typicalBuildPrice: csvNumber(
            csvValue(
              row,
              "Typical Build Price",
              "Typical Finished Value",
              "Finished Value",
            ),
          ),
          notes: noteLines([
            [
              "Buying status",
              csvValue(row, "Buying Status", "Status") ||
                (normalized.activeSignal ? "Actively Buying" : "Researching"),
            ],
            [
              "Evidence level",
              csvValue(row, "Evidence Level", "Evidence") || "Unverified",
            ],
            ["Property types", normalized.propertyTypes],
            ["Target markets", normalized.targetMarkets],
            ["Acquisition criteria", normalized.acquisitionCriteria],
            ["Active acquisition signal", normalized.activeSignal],
            ["Acreage range", csvValue(row, "Acreage Range", "Acreage")],
            [
              "Entitlement preference",
              csvValue(row, "Entitlement Preference", "Entitlement"),
            ],
            [
              "Utility requirements",
              csvValue(row, "Utility Requirements", "Utilities"),
            ],
            [
              "Preferred deal structure",
              csvValue(row, "Deal Structure", "Preferred Deal Structure"),
            ],
            ["Buy box source", normalized.source],
            ["Last verified", csvValue(row, "Last Verified", "Verified Date")],
            [
              "Next follow-up",
              csvValue(
                row,
                "Next Follow-up",
                "Next Follow Up",
                "Follow-up Date",
              ),
            ],
            ["Additional notes", csvValue(row, "Notes", "Additional Notes")],
          ]),
        },
      });
      createdIds.push(developer.id);
      created += 1;
    }
    await audit(
      tx,
      "csv.developers_imported",
      `Imported developer CSV: ${created} buyer(s) created, ${skipped} row(s) skipped.`,
      { sourceName: parsed.sourceName, rows: rows.length, created, skipped },
    );
  });
  return { rows: rows.length, created, skipped, createdIds };
}

export async function importPropertiesCsv(
  input: z.infer<typeof crmCsvImportSchema>,
) {
  const parsed = crmCsvImportSchema.parse(input);
  const rows = parseCsvRows(parsed.csvText);
  let incomplete = 0;
  let duplicates = 0;
  const createdIds: string[] = [];
  const candidates = rows.flatMap((row) => {
    const location = propertyCsvLocation(row);
    if (!location) {
      incomplete += 1;
      return [];
    }
    const { address, city, state, zipCode } = location;
    const contactPhone = Array.from({ length: 10 }, (_, index) => index + 1)
      .map((index) => ({
        phone: validPhone(csvValue(row, `Phone_${index}`)),
        blocked:
          csvFlag(csvValue(row, `Phone_${index}_DNC`)) ||
          csvFlag(csvValue(row, `Phone_${index}_IsLitigator`)),
      }))
      .find((entry) => entry.phone && !entry.blocked)?.phone;
    const contactEmail = Array.from({ length: 4 }, (_, index) => index + 1)
      .map((index) => validEmail(csvValue(row, `Email_${index}`)))
      .find(Boolean);
    return [
      {
        address,
        city,
        state,
        zipCode,
        ownerName:
          csvValue(
            row,
            "Owner1 Full Name",
            "Owner Full Name",
            "Owner Name",
            "Owner",
            "Full_Name",
          ) || "Unknown Owner",
        propertyType:
          csvValue(
            row,
            "Property Type",
            "Asset Type",
            "Asset Class",
            "Property_House_Type",
          ) || undefined,
        yearBuilt:
          csvValue(row, "Year Built", "Year", "Property_Year_Built") ||
          undefined,
        lotSize:
          csvValue(
            row,
            "Lot Size",
            "Acreage",
            "Acres",
            "Property_Lot_Size_Sq_Ft",
          ) || undefined,
        estimatedValue: csvNumber(
          csvValue(
            row,
            "Estimated Value",
            "Asking Price",
            "List Price",
            "Price",
            "Property_Estimated_Value",
          ),
        ),
        contactName:
          csvValue(
            row,
            "Contact Name",
            "Seller Contact",
            "Agency Contact",
            "Full_Name",
          ) || undefined,
        contactPhone:
          validPhone(csvValue(row, "Contact Phone", "Phone")) ||
          contactPhone ||
          undefined,
        contactEmail:
          validEmail(csvValue(row, "Contact Email", "Email")) ||
          contactEmail ||
          undefined,
        sourceName:
          csvValue(row, "Source Name", "Agency", "Government Source") ||
          parsed.sourceName ||
          undefined,
        sourceUrl:
          validUrl(
            csvValue(row, "Source URL", "Official URL", "Listing URL"),
          ) || undefined,
        sourceRecordDate:
          csvValue(
            row,
            "Record Date",
            "Listing Date",
            "Sale Date",
            "Skip_Traced_Date",
          ) || undefined,
        opportunityStatus: "NEEDS_VERIFICATION" as const,
        confidence: 0,
        notes: noteLines([
          [
            "Source",
            csvValue(row, "Source", "Source URL", "Skip_Traced_Source") ||
              parsed.sourceName ||
              "CSV import",
          ],
          ["County", csvValue(row, "County", "Property_County_Name")],
          ["Zoning", csvValue(row, "Zoning")],
          ["Utilities", csvValue(row, "Utilities")],
          ["Additional notes", csvValue(row, "Notes", "Additional Notes")],
        ]),
      },
    ];
  });
  const uniqueCandidates = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const key = `${candidate.address.trim().toLowerCase()}|${candidate.zipCode.trim()}`;
    if (uniqueCandidates.has(key)) duplicates += 1;
    else uniqueCandidates.set(key, candidate);
  }
  const deduplicated = [...uniqueCandidates.values()];
  const db = getPrisma();
  const existingKeys = new Set<string>();
  for (let offset = 0; offset < deduplicated.length; offset += 500) {
    const chunk = deduplicated.slice(offset, offset + 500);
    const existing = await db.property.findMany({
      where: {
        OR: chunk.map(({ address, zipCode }) => ({ address, zipCode })),
      },
      select: { address: true, zipCode: true },
    });
    for (const property of existing)
      existingKeys.add(
        `${property.address.trim().toLowerCase()}|${property.zipCode.trim()}`,
      );
  }
  const pending = deduplicated.filter((candidate) => {
    const exists = existingKeys.has(
      `${candidate.address.trim().toLowerCase()}|${candidate.zipCode.trim()}`,
    );
    if (exists) duplicates += 1;
    return !exists;
  });
  await db.$transaction(async (tx) => {
    for (let offset = 0; offset < pending.length; offset += 250) {
      const created = await tx.property.createManyAndReturn({
        data: pending.slice(offset, offset + 250),
        select: { id: true },
      });
      createdIds.push(...created.map(({ id }) => id));
    }
    await audit(
      tx,
      "csv.properties_imported",
      `Imported property CSV: ${createdIds.length} propertie(s) created, ${duplicates} duplicate row(s), ${incomplete} incomplete row(s).`,
      {
        sourceName: parsed.sourceName,
        rows: rows.length,
        created: createdIds.length,
        duplicates,
        incomplete,
      },
    );
  });
  return {
    rows: rows.length,
    created: createdIds.length,
    skipped: duplicates + incomplete,
    duplicates,
    incomplete,
    createdIds,
  };
}

export async function importForeclosureCsv(
  input: z.infer<typeof foreclosureCsvImportSchema>,
) {
  const parsed = foreclosureCsvImportSchema.parse(input);
  const rows = parseCsvRows(parsed.csvText);
  let propertiesCreated = 0;
  let leadsCreated = 0;
  let skipped = 0;
  let heldForVerification = 0;
  let readyForOwnerOutreach = 0;
  const numeric = (raw?: string) => {
    if (!raw) return undefined;
    const value = Number(raw.replace(/[$,\s]/g, ""));
    return Number.isFinite(value) ? value : undefined;
  };
  const truthy = (raw?: string) =>
    ["true", "yes", "y", "1", "pre-foreclosure", "preforeclosure"].includes(
      (raw ?? "").trim().toLowerCase(),
    );

  await getPrisma().$transaction(async (tx) => {
    for (const row of rows) {
      const address =
        row["Street Address"] || row["Property Address"] || row.Address;
      const city = row.City;
      const zipCode = row["Zip Code"] || row.Zip || row.ZIP;
      if (!address || !city || !zipCode) {
        skipped += 1;
        continue;
      }

      const ownerName =
        row["Owner1 Full Name"] ||
        row["Owner Full Name"] ||
        row["Owner Name"] ||
        "Unknown Owner";
      const sourceUrl =
        row["Source URL"] ||
        row["Official URL"] ||
        row["Foreclosure URL"] ||
        row["Listing URL"];
      const decision = routeForeclosure({
        stage:
          row["Foreclosure Stage"] ||
          row["Property Status"] ||
          row["Stage"],
        ownerName,
        preforeclosure:
          truthy(row.Preforeclosure) || truthy(row["Pre-Foreclosure"]),
        auctionDate:
          row["Auction Date"] ||
          row["Sale Date"] ||
          row["Trustee Sale Date"],
        sourceName: row.Source || parsed.sourceName,
        sourceUrl,
        authorizedSaleUrl: row["Listing URL"] || row["Bid URL"] || row["Authorized Sale URL"],
        estimatedValue: numeric(
          row["Estimated Value"] || row["Market Value"] || row["ARV"],
        ),
        estimatedDebt: numeric(
          row["Estimated Debt"] ||
            row["Loan Balance"] ||
            row["Total Debt"],
        ),
        liensAndTaxes: numeric(
          row["Liens and Taxes"] ||
            row["Total Liens"] ||
            row["Delinquent Taxes"],
        ),
      });
      const workflowNotes = [
        "--- Foreclosure routing ---",
        parsed.sourceName ? `Source: ${parsed.sourceName}` : "",
        `Foreclosure stage: ${decision.stage}`,
        `Acquisition route: ${decision.route}`,
        `Routing status: ${decision.status}`,
        `Next action: ${decision.nextAction}`,
        decision.estimatedEquity != null
          ? `Estimated equity before transaction costs: $${decision.estimatedEquity.toLocaleString("en-US")}`
          : "",
        decision.blockers.length
          ? `Routing blockers: ${decision.blockers.join("; ")}`
          : "Routing blockers: none",
        "--- End foreclosure routing ---",
      ]
        .filter(Boolean)
        .join("\n");

      const existing = await tx.property.findUnique({
        where: { address_zipCode: { address, zipCode } },
      });
      const property = existing
        ? await tx.property.update({
            where: { id: existing.id },
            data: {
              notes: [
                (existing.notes ?? "")
                  .replace(/\n?--- Foreclosure routing ---[\s\S]*?--- End foreclosure routing ---/g, "")
                  .trim(),
                workflowNotes,
              ]
                .filter(Boolean)
                .join("\n"),
              sourceUrl: sourceUrl || existing.sourceUrl,
              opportunityStatus:
                decision.stage === "HUD_OWNED" ||
                decision.stage === "TAX_FORECLOSURE"
                  ? "GOVERNMENT_SALE"
                  : existing.opportunityStatus,
            },
          })
        : await tx.property.create({
            data: {
              address,
              city,
              state: (row.State || "TX").toUpperCase(),
              zipCode,
              ownerName,
              yearBuilt: row["Year Built"] || undefined,
              estimatedValue: numeric(
                row["Estimated Value"] || row["Market Value"] || row["ARV"],
              ),
              sourceName: row.Source || parsed.sourceName,
              sourceUrl,
              opportunityStatus:
                decision.stage === "HUD_OWNED" ||
                decision.stage === "TAX_FORECLOSURE"
                  ? "GOVERNMENT_SALE"
                  : "NEEDS_VERIFICATION",
              notes: workflowNotes,
            },
          });
      if (!existing) propertiesCreated += 1;

      const readyForOutreach =
        decision.route === "OWNER_OUTREACH" &&
        decision.status === "READY_FOR_DILIGENCE" &&
        decision.canContactOwner;
      if (readyForOutreach) readyForOwnerOutreach += 1;
      else heldForVerification += 1;

      const existingLead = await tx.lead.findUnique({
        where: { propertyId: property.id },
      });
      const leadNotes = [
        `Route: ${decision.route}`,
        `Stage: ${decision.stage}`,
        decision.blockers.length
          ? `Blockers: ${decision.blockers.join("; ")}`
          : "Blockers: none",
        readyForOutreach
          ? "Personalized outreach may be drafted for approval."
          : "Outbound owner outreach remains locked until routing blockers are cleared.",
      ].join("\n");
      const lead = existingLead
        ? await tx.lead.update({
            where: { id: existingLead.id },
            data: {
              ownerName,
              status: readyForOutreach
                ? "READY_TO_CONTACT"
                : "RESEARCH_REQUIRED",
              priority: readyForOutreach ? "High" : "Medium",
              nextActionType: decision.nextAction,
              nextActionAt: "Today",
              notes: leadNotes,
            },
          })
        : await tx.lead.create({
            data: {
              propertyId: property.id,
              ownerName,
              status: readyForOutreach
                ? "READY_TO_CONTACT"
                : "RESEARCH_REQUIRED",
              priority: readyForOutreach ? "High" : "Medium",
              nextActionType: decision.nextAction,
              nextActionAt: "Today",
              notes: leadNotes,
            },
          });
      await tx.task.upsert({
        where: {
          leadId_title: {
            leadId: lead.id,
            title: lead.nextActionType,
          },
        },
        update: {
          type: "FORECLOSURE_ROUTING_REVIEW",
          priority: lead.priority,
          dueAt: lead.nextActionAt,
          status: "OPEN",
          completedAt: null,
        },
        create: {
          leadId: lead.id,
          title: lead.nextActionType,
          type: "FORECLOSURE_ROUTING_REVIEW",
          priority: lead.priority,
          dueAt: lead.nextActionAt,
        },
      });
      if (!existingLead) leadsCreated += 1;
    }

    await audit(
      tx,
      "csv.foreclosure_imported",
      `Imported foreclosure CSV: ${propertiesCreated} propertie(s), ${leadsCreated} routed lead(s), ${heldForVerification} held for verification, ${readyForOwnerOutreach} ready for owner outreach.`,
      {
        sourceName: parsed.sourceName,
        rows: rows.length,
        skipped,
        heldForVerification,
        readyForOwnerOutreach,
      },
    );
  });
  return {
    rows: rows.length,
    propertiesCreated,
    leadsCreated,
    skipped,
    heldForVerification,
    readyForOwnerOutreach,
  };
}

export const __testables = {
  calculateMatches,
  calculateDeveloperPropertyMatches,
  propertyCsvLocation,
  qualificationFor,
  parseCsvLine,
  parseCsvRows,
};
