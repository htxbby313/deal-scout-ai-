import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { leads as seedLeads, messageDrafts, neighborhoods, developers, developerProjects } from "@/lib/seed-data";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "deal-scout-db.json");
const MIGRATION_VERSION = 3;

export type AuditType =
  | "database.migrated"
  | "property.created"
  | "lead.created"
  | "task.created"
  | "message.template.created"
  | "message.draft.generated"
  | "message.approved"
  | "message.rejected"
  | "developer.created"
  | "developer.project.created"
  | "developer.matches.scored"
  | "developer.pricing_request.created"
  | "provider.blocked"
  | "webhook.received"
  | "scheduler.followups";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SENT_BLOCKED";

export type PropertyRecord = {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName: string;
  yearBuilt?: string;
  lotSize?: string;
  estimatedValue?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  targetZipCodes: string[];
  maximumPurchasePrice?: number;
  typicalBuildPrice?: number;
  notes?: string;
  active: boolean;
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
  state: z.string().min(2).max(2),
  zipCode: z.string().min(5),
  ownerName: z.string().min(2),
  yearBuilt: z.string().optional(),
  lotSize: z.string().optional(),
  notes: z.string().optional(),
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
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  targetZipCodes: z.string().min(5),
  maximumPurchasePrice: z.coerce.number().min(0).optional(),
  typicalBuildPrice: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export const developerProjectInputSchema = z.object({
  developerId: z.string().min(1),
  address: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2).max(2),
  zipCode: z.string().min(5),
  originalPurchasePrice: z.coerce.number().min(0).optional(),
  newBuildSalePrice: z.coerce.number().min(0).optional(),
  lotSquareFeet: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

function initialDatabase(): Database {
  const createdAt = now();
  const properties: PropertyRecord[] = seedLeads.slice(0, 5).map((lead, index) => ({
    id: `prop_seed_${index + 1}`,
    address: lead.property,
    city: lead.city,
    state: "TX",
    zipCode: lead.zipCode,
    ownerName: lead.owner,
    notes: lead.reason,
    createdAt,
    updatedAt: createdAt,
  }));

  const leads: LeadRecord[] = seedLeads.slice(0, 5).map((lead, index) => ({
    id: `lead_seed_${index + 1}`,
    propertyId: properties[index].id,
    ownerName: lead.owner,
    status: lead.status,
    priority: lead.priority,
    nextActionType: lead.nextActionType,
    nextActionAt: lead.nextActionAt,
    estimatedAssignmentFee: lead.estimatedAssignmentFee,
    notes: lead.reason,
    createdAt,
    updatedAt: createdAt,
  }));

  const templates: MessageTemplate[] = messageDrafts.map((draft, index) => ({
    id: `tmpl_seed_${index + 1}`,
    type: draft.type,
    channel: draft.type.includes("SMS") ? "SMS" : "EMAIL",
    body: draft.draft,
    active: true,
    createdAt,
    updatedAt: createdAt,
  }));

  const developerRecords: DeveloperRecord[] = developers.map((developer, index) => ({
    id: `dev_seed_${index + 1}`,
    companyName: developer.companyName,
    contactName: developer.contactName,
    targetZipCodes: developer.targetZipCodes,
    maximumPurchasePrice: developer.maximumPurchasePrice,
    typicalBuildPrice: developer.typicalBuildPrice,
    notes: `Response speed: ${developer.responseSpeed}`,
    active: developer.active,
    createdAt,
    updatedAt: createdAt,
  }));

  const projectRecords: DeveloperProjectRecord[] = developerProjects.map((project, index) => {
    const developer = developerRecords.find((record) => record.companyName === project.developer) ?? developerRecords[0];
    return {
      id: `devproj_seed_${index + 1}`,
      developerId: developer.id,
      address: project.address,
      city: "Dallas",
      state: "TX",
      zipCode: developer.targetZipCodes[0] ?? "00000",
      originalPurchasePrice: project.originalPurchasePrice,
      newBuildSalePrice: project.newBuildSalePrice,
      createdAt,
      updatedAt: createdAt,
    };
  });

  return {
    meta: {
      migrationVersion: MIGRATION_VERSION,
      systemMode: "RESEARCH",
      smsProviderEnabled: false,
      emailProviderEnabled: false,
      voiceProviderEnabled: false,
      createdAt,
      updatedAt: createdAt,
    },
    properties,
    leads,
    developers: developerRecords,
    developerProjects: projectRecords,
    tasks: leads.map((lead, index) => ({
      id: `task_seed_${index + 1}`,
      leadId: lead.id,
      title: lead.nextActionType,
      type: "FOLLOW_UP",
      priority: lead.priority,
      status: "OPEN",
      dueAt: lead.nextActionAt,
      createdAt,
      updatedAt: createdAt,
    })),
    messageTemplates: templates,
    messageApprovals: [
      {
        id: "approval_seed_1",
        leadId: leads[0].id,
        templateId: templates[0]?.id,
        channel: "SMS",
        recipientLabel: leads[0].ownerName,
        body: templates[0]?.body ?? "Follow up with seller.",
        status: "PENDING",
        provider: "disabled",
        createdAt,
        updatedAt: createdAt,
      },
    ],
    auditLogs: [
      {
        id: "audit_seed_1",
        type: "database.migrated",
        summary: "Initialized local database with seed records.",
        details: {
          neighborhoods: neighborhoods.length,
          developers: developers.length,
        },
        createdAt,
      },
    ],
  };
}

function ensureDatabase(): Database {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!existsSync(DB_PATH)) {
    const db = initialDatabase();
    writeDatabase(db);
    return db;
  }

  const raw = readFileSync(DB_PATH, "utf8");
  const db = JSON.parse(raw) as Database;
  const seed = initialDatabase();
  if (!db.developers || !db.developerProjects) {
    db.developers = db.developers ?? seed.developers;
    db.developerProjects = db.developerProjects ?? seed.developerProjects;
    db.auditLogs = db.auditLogs ?? [];
    db.auditLogs.unshift({
      id: id("audit"),
      type: "database.migrated",
      summary: "Backfilled developer research tables.",
      createdAt: now(),
    });
    writeDatabase(db);
  }
  if (!db.meta || db.meta.migrationVersion < MIGRATION_VERSION) {
    db.meta = {
      ...seed.meta,
      ...db.meta,
      migrationVersion: MIGRATION_VERSION,
      updatedAt: now(),
    };
    db.auditLogs = db.auditLogs ?? [];
    db.auditLogs.unshift({
      id: id("audit"),
      type: "database.migrated",
      summary: `Migrated local database to version ${MIGRATION_VERSION}.`,
      createdAt: now(),
    });
    writeDatabase(db);
  }
  return db;
}

export function readDatabase(): Database {
  return ensureDatabase();
}

export function writeDatabase(db: Database) {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function databaseInfo() {
  const db = readDatabase();
  return {
    path: DB_PATH,
    migrationVersion: db.meta.migrationVersion,
    systemMode: db.meta.systemMode,
  };
}

export function addAudit(db: Database, type: AuditType, summary: string, details?: Record<string, unknown>) {
  db.auditLogs.unshift({ id: id("audit"), type, summary, details, createdAt: now() });
  db.auditLogs = db.auditLogs.slice(0, 100);
}

export function createProperty(input: z.infer<typeof propertyInputSchema>) {
  const db = readDatabase();
  const parsed = propertyInputSchema.parse(input);
  const createdAt = now();
  const property: PropertyRecord = {
    id: id("prop"),
    ...parsed,
    createdAt,
    updatedAt: createdAt,
  };
  db.properties.unshift(property);
  addAudit(db, "property.created", `Created property ${property.address}.`, { propertyId: property.id });
  writeDatabase(db);
  return property;
}

export function createLead(input: z.infer<typeof leadInputSchema>) {
  const db = readDatabase();
  const parsed = leadInputSchema.parse(input);
  const createdAt = now();
  const lead: LeadRecord = {
    id: id("lead"),
    ...parsed,
    createdAt,
    updatedAt: createdAt,
  };
  db.leads.unshift(lead);
  const task: TaskRecord = {
    id: id("task"),
    leadId: lead.id,
    title: lead.nextActionType,
    type: "NEXT_ACTION",
    priority: lead.priority,
    status: "OPEN",
    dueAt: lead.nextActionAt,
    createdAt,
    updatedAt: createdAt,
  };
  db.tasks.unshift(task);
  addAudit(db, "lead.created", `Created lead for ${lead.ownerName}.`, { leadId: lead.id, propertyId: lead.propertyId });
  addAudit(db, "task.created", `Created next-action task: ${task.title}.`, { taskId: task.id, leadId: lead.id });
  writeDatabase(db);
  return lead;
}

export function createMessageTemplate(input: z.infer<typeof templateInputSchema>) {
  const db = readDatabase();
  const parsed = templateInputSchema.parse(input);
  const createdAt = now();
  const template: MessageTemplate = {
    id: id("tmpl"),
    ...parsed,
    active: true,
    createdAt,
    updatedAt: createdAt,
  };
  db.messageTemplates.unshift(template);
  addAudit(db, "message.template.created", `Created ${template.channel} template: ${template.type}.`, { templateId: template.id });
  writeDatabase(db);
  return template;
}

export function createDeveloper(input: z.infer<typeof developerInputSchema>) {
  const db = readDatabase();
  const parsed = developerInputSchema.parse(input);
  const createdAt = now();
  const developer: DeveloperRecord = {
    id: id("dev"),
    companyName: parsed.companyName,
    contactName: parsed.contactName,
    phone: parsed.phone,
    email: parsed.email,
    website: parsed.website,
    targetZipCodes: parsed.targetZipCodes
      .split(",")
      .map((zip) => zip.trim())
      .filter(Boolean),
    maximumPurchasePrice: parsed.maximumPurchasePrice,
    typicalBuildPrice: parsed.typicalBuildPrice,
    notes: parsed.notes,
    active: true,
    createdAt,
    updatedAt: createdAt,
  };
  db.developers.unshift(developer);
  addAudit(db, "developer.created", `Created developer ${developer.companyName}.`, { developerId: developer.id });
  writeDatabase(db);
  return developer;
}

export function createDeveloperProject(input: z.infer<typeof developerProjectInputSchema>) {
  const db = readDatabase();
  const parsed = developerProjectInputSchema.parse(input);
  const createdAt = now();
  const project: DeveloperProjectRecord = {
    id: id("devproj"),
    ...parsed,
    state: parsed.state.toUpperCase(),
    createdAt,
    updatedAt: createdAt,
  };
  db.developerProjects.unshift(project);
  addAudit(db, "developer.project.created", `Recorded developer project ${project.address}.`, {
    developerId: project.developerId,
    projectId: project.id,
  });
  writeDatabase(db);
  return project;
}

export function scoreDeveloperMatches(propertyId: string, writeAudit = true): DeveloperMatch[] {
  const db = readDatabase();
  const property = db.properties.find((item) => item.id === propertyId);
  if (!property) {
    return [];
  }

  const matches = db.developers
    .filter((developer) => developer.active)
    .map((developer) => {
      let score = 20;
      const reasons: string[] = [];
      const projects = db.developerProjects.filter((project) => project.developerId === developer.id);

      if (developer.targetZipCodes.includes(property.zipCode)) {
        score += 35;
        reasons.push("Builds in the same ZIP code.");
      }

      const cityProjectCount = projects.filter((project) => project.city.toLowerCase() === property.city.toLowerCase()).length;
      if (cityProjectCount > 0) {
        score += Math.min(20, cityProjectCount * 8);
        reasons.push(`Has ${cityProjectCount} known project(s) in the same city.`);
      }

      if (developer.maximumPurchasePrice && property.estimatedValue && developer.maximumPurchasePrice >= property.estimatedValue) {
        score += 15;
        reasons.push("Maximum purchase price can cover the estimated value.");
      } else if (developer.maximumPurchasePrice) {
        score += 8;
        reasons.push("Known maximum purchase price is available for underwriting.");
      }

      if (developer.typicalBuildPrice && developer.typicalBuildPrice >= 3000000) {
        score += 10;
        reasons.push("Typical build value supports high-end redevelopment.");
      }

      if (!reasons.length) {
        reasons.push("General active developer; add more project history for stronger scoring.");
      }

      return {
        developerId: developer.id,
        score: Math.min(100, score),
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (writeAudit) {
    addAudit(db, "developer.matches.scored", `Scored ${matches.length} developer match(es) for ${property.address}.`, {
      propertyId,
      topScore: matches[0]?.score ?? 0,
    });
    writeDatabase(db);
  }
  return matches;
}

export function generateDeveloperPricingRequest(propertyId: string, developerId: string) {
  const db = readDatabase();
  const property = db.properties.find((item) => item.id === propertyId);
  const developer = db.developers.find((item) => item.id === developerId);
  const lead = db.leads.find((item) => item.propertyId === propertyId);
  if (!property || !developer) {
    throw new Error("Property or developer not found.");
  }
  const matches = scoreDeveloperMatches(propertyId);
  const match = matches.find((item) => item.developerId === developerId);
  const createdAt = now();
  const body = [
    `I have a possible property in ${property.zipCode}.`,
    "",
    `Address: ${property.address}`,
    `Lot size: ${property.lotSize || "unknown"}`,
    `Year built: ${property.yearBuilt || "unknown"}`,
    `Nearby / fit notes: ${(match?.reasons ?? []).join(" ") || "Potential redevelopment candidate."}`,
    "",
    "Where would you need to be on price?",
  ].join("\n");

  const approval: MessageApproval = {
    id: id("approval"),
    leadId: lead?.id,
    channel: "EMAIL",
    recipientLabel: developer.companyName,
    subject: `Pricing request: ${property.address}`,
    body,
    status: "PENDING",
    provider: "disabled",
    createdAt,
    updatedAt: createdAt,
  };
  db.messageApprovals.unshift(approval);
  addAudit(db, "developer.pricing_request.created", `Generated pricing request for ${developer.companyName}.`, {
    developerId,
    propertyId,
    approvalId: approval.id,
    matchScore: match?.score,
  });
  writeDatabase(db);
  return approval;
}

export function generateDraftApproval(templateId: string, leadId: string) {
  const db = readDatabase();
  const template = db.messageTemplates.find((item) => item.id === templateId);
  const lead = db.leads.find((item) => item.id === leadId);
  if (!template || !lead) {
    throw new Error("Template or lead not found.");
  }
  const property = db.properties.find((item) => item.id === lead.propertyId);
  const createdAt = now();
  const body = template.body
    .replaceAll("[OWNER]", lead.ownerName)
    .replaceAll("[PROPERTY]", property?.address ?? "the property")
    .replaceAll("[ZIP]", property?.zipCode ?? "");

  const approval: MessageApproval = {
    id: id("approval"),
    leadId: lead.id,
    templateId: template.id,
    channel: template.channel,
    recipientLabel: lead.ownerName,
    body,
    status: "PENDING",
    provider: "disabled",
    createdAt,
    updatedAt: createdAt,
  };
  db.messageApprovals.unshift(approval);
  addAudit(db, "message.draft.generated", `Generated ${template.channel} draft for ${lead.ownerName}.`, {
    approvalId: approval.id,
    leadId: lead.id,
  });
  writeDatabase(db);
  return approval;
}

export function setApprovalStatus(approvalId: string, status: "APPROVED" | "REJECTED") {
  const db = readDatabase();
  const approval = db.messageApprovals.find((item) => item.id === approvalId);
  if (!approval) {
    throw new Error("Approval not found.");
  }
  approval.status = status;
  approval.updatedAt = now();
  addAudit(
    db,
    status === "APPROVED" ? "message.approved" : "message.rejected",
    `${status === "APPROVED" ? "Approved" : "Rejected"} ${approval.channel} draft for ${approval.recipientLabel}.`,
    { approvalId },
  );
  writeDatabase(db);
  return approval;
}

export function attemptProviderSend(approvalId: string) {
  const db = readDatabase();
  const approval = db.messageApprovals.find((item) => item.id === approvalId);
  if (!approval) {
    throw new Error("Approval not found.");
  }
  approval.status = "SENT_BLOCKED";
  approval.updatedAt = now();
  addAudit(db, "provider.blocked", `Blocked outbound ${approval.channel}; provider is disabled in Research Mode.`, {
    approvalId,
    systemMode: db.meta.systemMode,
  });
  writeDatabase(db);
  return approval;
}

export function runFollowUpScheduler() {
  const db = readDatabase();
  const createdAt = now();
  let created = 0;
  for (const lead of db.leads.slice(0, 10)) {
    const exists = db.tasks.some((task) => task.leadId === lead.id && task.title === `Follow up: ${lead.nextActionType}`);
    if (!exists) {
      db.tasks.unshift({
        id: id("task"),
        leadId: lead.id,
        title: `Follow up: ${lead.nextActionType}`,
        type: "SCHEDULED_FOLLOW_UP",
        priority: lead.priority,
        status: "OPEN",
        dueAt: lead.nextActionAt,
        createdAt,
        updatedAt: createdAt,
      });
      created += 1;
    }
  }
  addAudit(db, "scheduler.followups", `Follow-up scheduler created ${created} task(s).`, { created });
  writeDatabase(db);
  return { created };
}

export function recordWebhook(type: "message" | "call", payload: Record<string, unknown>) {
  const db = readDatabase();
  addAudit(db, "webhook.received", `Received ${type} webhook.`, payload);
  writeDatabase(db);
}
