import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import { PrismaClientKnownRequestError, type InputJsonValue } from "@prisma/client/runtime/library";
import { z } from "zod";

import { getPrisma } from "@/lib/prisma";
import { canSendOutbound } from "@/lib/domain";

export type AuditType =
  | "database.migrated" | "property.created" | "lead.created" | "task.created" | "task.completed"
  | "message.template.created" | "message.draft.generated" | "message.approved" | "message.rejected"
  | "developer.created" | "developer.project.created" | "developer.matches.scored"
  | "developer.pricing_request.created" | "csv.foreclosure_imported" | "csv.developers_imported"
  | "csv.properties_imported" | "provider.blocked"
  | "webhook.received" | "scheduler.followups";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "SENT_BLOCKED";
export type PropertyRecord = { id: string; address: string; city: string; state: string; zipCode: string; ownerName: string; yearBuilt?: string; lotSize?: string; estimatedValue?: number; notes?: string; createdAt: string; updatedAt: string };
export type LeadRecord = { id: string; propertyId: string; ownerName: string; status: string; priority: string; nextActionType: string; nextActionAt: string; estimatedAssignmentFee: number; notes?: string; createdAt: string; updatedAt: string };
export type TaskRecord = { id: string; leadId: string; title: string; type: string; priority: string; status: "OPEN" | "DONE"; dueAt: string; createdAt: string; updatedAt: string };
export type MessageTemplate = { id: string; type: string; channel: "SMS" | "EMAIL" | "VOICE" | "INTERNAL"; body: string; active: boolean; createdAt: string; updatedAt: string };
export type MessageApproval = { id: string; leadId?: string; templateId?: string; channel: "SMS" | "EMAIL" | "VOICE" | "INTERNAL"; recipientLabel: string; subject?: string; body: string; status: ApprovalStatus; provider: string; createdAt: string; updatedAt: string };
export type DeveloperRecord = { id: string; companyName: string; contactName?: string; phone?: string; email?: string; website?: string; targetZipCodes: string[]; maximumPurchasePrice?: number; typicalBuildPrice?: number; notes?: string; active: boolean; createdAt: string; updatedAt: string };
export type DeveloperProjectRecord = { id: string; developerId: string; address: string; city: string; state: string; zipCode: string; originalPurchasePrice?: number; newBuildSalePrice?: number; lotSquareFeet?: number; notes?: string; createdAt: string; updatedAt: string };
export type DeveloperMatch = { developerId: string; score: number; reasons: string[] };
export type AuditLog = { id: string; type: AuditType; summary: string; details?: Record<string, unknown>; createdAt: string };
export type Database = {
  meta: { migrationVersion: number; systemMode: "RESEARCH" | "ACTIVE" | "PAUSED"; smsProviderEnabled: boolean; emailProviderEnabled: boolean; voiceProviderEnabled: boolean; createdAt: string; updatedAt: string };
  properties: PropertyRecord[]; leads: LeadRecord[]; tasks: TaskRecord[]; developers: DeveloperRecord[];
  developerProjects: DeveloperProjectRecord[]; messageTemplates: MessageTemplate[];
  messageApprovals: MessageApproval[]; auditLogs: AuditLog[];
};

export const propertyInputSchema = z.object({ address: z.string().min(3), city: z.string().min(2), state: z.string().length(2), zipCode: z.string().min(5), ownerName: z.string().min(2), yearBuilt: z.string().optional(), lotSize: z.string().optional(), estimatedValue: z.coerce.number().min(0).optional(), notes: z.string().optional() });
export const leadInputSchema = z.object({ propertyId: z.string().min(1), ownerName: z.string().min(2), status: z.string().min(2), priority: z.string().min(2), nextActionType: z.string().min(2), nextActionAt: z.string().min(2), estimatedAssignmentFee: z.coerce.number().min(0), notes: z.string().optional() });
export const templateInputSchema = z.object({ type: z.string().min(2), channel: z.enum(["SMS", "EMAIL", "VOICE", "INTERNAL"]), body: z.string().min(10) });
export const developerInputSchema = z.object({ companyName: z.string().min(2), contactName: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), website: z.string().optional(), targetZipCodes: z.string().min(5), maximumPurchasePrice: z.coerce.number().min(0).optional(), typicalBuildPrice: z.coerce.number().min(0).optional(), notes: z.string().optional() });
export const developerProjectInputSchema = z.object({ developerId: z.string().min(1), address: z.string().min(3), city: z.string().min(2), state: z.string().length(2), zipCode: z.string().min(5), originalPurchasePrice: z.coerce.number().min(0).optional(), newBuildSalePrice: z.coerce.number().min(0).optional(), lotSquareFeet: z.coerce.number().min(0).optional(), notes: z.string().optional() });
export const foreclosureCsvImportSchema = z.object({ csvText: z.string().min(10), sourceName: z.string().optional() });
export const crmCsvImportSchema = z.object({ csvText: z.string().min(3), sourceName: z.string().optional() });

const iso = (value: Date) => value.toISOString();
const optional = <T>(value: T | null) => value ?? undefined;
function safeError(error: unknown, operation: string): never {
  console.error(`Database operation failed: ${operation}`, error);
  if (error instanceof z.ZodError) throw error;
  if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
    throw new Error("That record already exists.");
  }
  throw new Error(`Unable to ${operation}. Please try again.`);
}
async function audit(tx: Prisma.TransactionClient | PrismaClient, type: AuditType, summary: string, details?: Record<string, unknown>) {
  await tx.auditLog.create({ data: { type, summary, details: details as InputJsonValue | undefined } });
}

export async function readDatabase(): Promise<Database> {
  try {
    const db = getPrisma();
    const [setting, providers, properties, leads, tasks, developers, developerProjects, templates, approvals, logs] = await Promise.all([
      db.systemSetting.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", mode: "RESEARCH" } }),
      Promise.all(["SMS", "EMAIL", "VOICE"].map((provider) => db.providerSetting.upsert({ where: { provider }, update: {}, create: { provider, enabled: false, configured: false } }))),
      db.property.findMany({ orderBy: { createdAt: "desc" } }), db.lead.findMany({ orderBy: { createdAt: "desc" } }),
      db.task.findMany({ orderBy: { createdAt: "desc" } }), db.developer.findMany({ orderBy: { createdAt: "desc" } }),
      db.developerProject.findMany({ orderBy: { createdAt: "desc" } }), db.messageTemplate.findMany({ orderBy: { createdAt: "desc" } }),
      db.messageApproval.findMany({ orderBy: { createdAt: "desc" } }), db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    const enabled = (name: string) => providers.find((p) => p.provider === name)?.enabled === true;
    return {
      meta: { migrationVersion: setting.migrationVersion, systemMode: setting.mode, smsProviderEnabled: enabled("SMS"), emailProviderEnabled: enabled("EMAIL"), voiceProviderEnabled: enabled("VOICE"), createdAt: iso(setting.createdAt), updatedAt: iso(setting.updatedAt) },
      properties: properties.map((p) => ({ ...p, yearBuilt: optional(p.yearBuilt), lotSize: optional(p.lotSize), estimatedValue: optional(p.estimatedValue), notes: optional(p.notes), createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) })),
      leads: leads.map((l) => ({ ...l, notes: optional(l.notes), createdAt: iso(l.createdAt), updatedAt: iso(l.updatedAt) })),
      tasks: tasks.map((t) => ({ ...t, status: t.status as "OPEN" | "DONE", createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt) })),
      developers: developers.map((d) => ({ ...d, contactName: optional(d.contactName), phone: optional(d.phone), email: optional(d.email), website: optional(d.website), maximumPurchasePrice: optional(d.maximumPurchasePrice), typicalBuildPrice: optional(d.typicalBuildPrice), notes: optional(d.notes), createdAt: iso(d.createdAt), updatedAt: iso(d.updatedAt) })),
      developerProjects: developerProjects.map((p) => ({ ...p, originalPurchasePrice: optional(p.originalPurchasePrice), newBuildSalePrice: optional(p.newBuildSalePrice), lotSquareFeet: optional(p.lotSquareFeet), notes: optional(p.notes), createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt) })),
      messageTemplates: templates.map((t) => ({ ...t, channel: t.channel as MessageTemplate["channel"], createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt) })),
      messageApprovals: approvals.map((a) => ({ ...a, leadId: optional(a.leadId), templateId: optional(a.templateId), subject: optional(a.subject), channel: a.channel as MessageApproval["channel"], status: a.status as ApprovalStatus, createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt) })),
      auditLogs: logs.map((l) => ({ id: l.id, type: l.type as AuditType, summary: l.summary, details: optional(l.details as Record<string, unknown> | null), createdAt: iso(l.createdAt) })),
    };
  } catch (error) { return safeError(error, "load Deal Scout data"); }
}

export async function databaseInfo() {
  const db = await readDatabase();
  return { path: "PostgreSQL via Prisma", migrationVersion: db.meta.migrationVersion, systemMode: db.meta.systemMode };
}

export async function createProperty(input: z.infer<typeof propertyInputSchema>) {
  try {
    const parsed = propertyInputSchema.parse(input);
    return await getPrisma().$transaction(async (tx) => {
      const property = await tx.property.create({ data: { ...parsed, state: parsed.state.toUpperCase() } });
      await audit(tx, "property.created", `Created property ${property.address}.`, { propertyId: property.id });
      return property;
    });
  } catch (error) { return safeError(error, "create property"); }
}

export async function createLead(input: z.infer<typeof leadInputSchema>) {
  try {
    const parsed = leadInputSchema.parse(input);
    return await getPrisma().$transaction(async (tx) => {
      const lead = await tx.lead.create({ data: parsed });
      const task = await tx.task.create({ data: { leadId: lead.id, title: lead.nextActionType, type: "NEXT_ACTION", priority: lead.priority, dueAt: lead.nextActionAt } });
      await audit(tx, "lead.created", `Created lead for ${lead.ownerName}.`, { leadId: lead.id, propertyId: lead.propertyId });
      await audit(tx, "task.created", `Created next-action task: ${task.title}.`, { taskId: task.id, leadId: lead.id });
      return lead;
    });
  } catch (error) { return safeError(error, "create lead"); }
}

export async function completeTask(taskId: string) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const task = await tx.task.update({ where: { id: taskId }, data: { status: "DONE", completedAt: new Date() } });
      await audit(tx, "task.completed", `Completed task: ${task.title}.`, { taskId });
      return task;
    });
  } catch (error) { return safeError(error, "complete task"); }
}

export async function createMessageTemplate(input: z.infer<typeof templateInputSchema>) {
  try { const parsed = templateInputSchema.parse(input); return await getPrisma().$transaction(async (tx) => { const record = await tx.messageTemplate.create({ data: parsed }); await audit(tx, "message.template.created", `Created ${record.channel} template: ${record.type}.`, { templateId: record.id }); return record; }); }
  catch (error) { return safeError(error, "create message template"); }
}
export async function createDeveloper(input: z.infer<typeof developerInputSchema>) {
  try { const p = developerInputSchema.parse(input); return await getPrisma().$transaction(async (tx) => { const record = await tx.developer.create({ data: { ...p, targetZipCodes: p.targetZipCodes.split(",").map((v) => v.trim()).filter(Boolean) } }); await audit(tx, "developer.created", `Created developer ${record.companyName}.`, { developerId: record.id }); return record; }); }
  catch (error) { return safeError(error, "create developer"); }
}
export async function createDeveloperProject(input: z.infer<typeof developerProjectInputSchema>) {
  try { const p = developerProjectInputSchema.parse(input); return await getPrisma().$transaction(async (tx) => { const record = await tx.developerProject.create({ data: { ...p, state: p.state.toUpperCase() } }); await audit(tx, "developer.project.created", `Recorded developer project ${record.address}.`, { developerId: record.developerId, projectId: record.id }); return record; }); }
  catch (error) { return safeError(error, "create developer project"); }
}

function calculateMatches(property: PropertyRecord, developers: DeveloperRecord[], projects: DeveloperProjectRecord[]) {
  return developers.filter((d) => d.active).map((developer) => {
    let score = 20; const reasons: string[] = []; const history = projects.filter((p) => p.developerId === developer.id);
    if (developer.targetZipCodes.includes(property.zipCode)) { score += 35; reasons.push("Builds in the same ZIP code."); }
    const cityCount = history.filter((p) => p.city.toLowerCase() === property.city.toLowerCase()).length;
    if (cityCount) { score += Math.min(20, cityCount * 8); reasons.push(`Has ${cityCount} known project(s) in the same city.`); }
    if (developer.maximumPurchasePrice && property.estimatedValue && developer.maximumPurchasePrice >= property.estimatedValue) { score += 15; reasons.push("Maximum purchase price can cover the estimated value."); }
    else if (developer.maximumPurchasePrice) { score += 8; reasons.push("Known maximum purchase price is available for underwriting."); }
    if (developer.typicalBuildPrice && developer.typicalBuildPrice >= 3_000_000) { score += 10; reasons.push("Typical build value supports high-end redevelopment."); }
    if (!reasons.length) reasons.push("General active developer; add more project history for stronger scoring.");
    return { developerId: developer.id, score: Math.min(100, score), reasons };
  }).sort((a, b) => b.score - a.score);
}

export async function scoreDeveloperMatches(propertyId: string, writeAudit = true): Promise<DeveloperMatch[]> {
  try {
    const data = await readDatabase(); const property = data.properties.find((p) => p.id === propertyId); if (!property) return [];
    const matches = calculateMatches(property, data.developers, data.developerProjects);
    if (writeAudit) await getPrisma().$transaction(async (tx) => {
      for (const match of matches) await tx.developerMatch.upsert({ where: { propertyId_developerId: { propertyId, developerId: match.developerId } }, update: { score: match.score, reasons: match.reasons }, create: { propertyId, ...match } });
      await audit(tx, "developer.matches.scored", `Scored ${matches.length} developer match(es) for ${property.address}.`, { propertyId, topScore: matches[0]?.score ?? 0 });
    });
    return matches;
  } catch (error) { return safeError(error, "score developer matches"); }
}

export async function generateDraftApproval(templateId: string, leadId: string) {
  try { const db = getPrisma(); const [template, lead] = await Promise.all([db.messageTemplate.findUnique({ where: { id: templateId } }), db.lead.findUnique({ where: { id: leadId }, include: { property: true } })]); if (!template || !lead) throw new Error("Template or lead not found."); const body = template.body.replaceAll("[OWNER]", lead.ownerName).replaceAll("[PROPERTY]", lead.property.address).replaceAll("[ZIP]", lead.property.zipCode); return await db.$transaction(async (tx) => { const approval = await tx.messageApproval.create({ data: { leadId, templateId, channel: template.channel, recipientLabel: lead.ownerName, body, status: "PENDING", provider: "disabled" } }); await audit(tx, "message.draft.generated", `Generated ${template.channel} draft for ${lead.ownerName}.`, { approvalId: approval.id, leadId }); return approval; }); }
  catch (error) { return safeError(error, "generate message draft"); }
}
export async function generateDeveloperPricingRequest(propertyId: string, developerId: string) {
  try { const db = getPrisma(); const [property, developer, lead] = await Promise.all([db.property.findUnique({ where: { id: propertyId } }), db.developer.findUnique({ where: { id: developerId } }), db.lead.findUnique({ where: { propertyId } })]); if (!property || !developer) throw new Error("Property or developer not found."); const matches = await scoreDeveloperMatches(propertyId, false); const match = matches.find((m) => m.developerId === developerId); const body = `I have a possible property in ${property.zipCode}.\n\nAddress: ${property.address}\nLot size: ${property.lotSize || "unknown"}\nYear built: ${property.yearBuilt || "unknown"}\nNearby / fit notes: ${(match?.reasons ?? []).join(" ") || "Potential redevelopment candidate."}\n\nWhere would you need to be on price?`; return await db.$transaction(async (tx) => { const approval = await tx.messageApproval.create({ data: { leadId: lead?.id, channel: "EMAIL", recipientLabel: developer.companyName, subject: `Pricing request: ${property.address}`, body } }); await audit(tx, "developer.pricing_request.created", `Generated pricing request for ${developer.companyName}.`, { developerId, propertyId, approvalId: approval.id, matchScore: match?.score }); return approval; }); }
  catch (error) { return safeError(error, "generate developer pricing request"); }
}
export async function setApprovalStatus(approvalId: string, status: "APPROVED" | "REJECTED") {
  try { return await getPrisma().$transaction(async (tx) => { const approval = await tx.messageApproval.update({ where: { id: approvalId }, data: { status } }); await audit(tx, status === "APPROVED" ? "message.approved" : "message.rejected", `${status === "APPROVED" ? "Approved" : "Rejected"} ${approval.channel} draft for ${approval.recipientLabel}.`, { approvalId }); return approval; }); }
  catch (error) { return safeError(error, "update message approval"); }
}

export async function attemptProviderSend(approvalId: string) {
  try {
    return await getPrisma().$transaction(async (tx) => {
      const approval = await tx.messageApproval.findUnique({ where: { id: approvalId } }); if (!approval) throw new Error("Approval not found.");
      const setting = await tx.systemSetting.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton", mode: "RESEARCH" } });
      const provider = await tx.providerSetting.upsert({ where: { provider: approval.channel }, update: {}, create: { provider: approval.channel, enabled: false, configured: false } });
      const envConfigured = Boolean(process.env[`${approval.channel}_PROVIDER_API_KEY`]);
      if (!canSendOutbound({ approvalStatus: approval.status, systemMode: setting.mode, providerEnabled: provider.enabled, providerConfigured: provider.configured, environmentConfigured: envConfigured })) {
        const blocked = await tx.messageApproval.update({ where: { id: approvalId }, data: { status: "SENT_BLOCKED", provider: "disabled" } });
        await audit(tx, "provider.blocked", `Blocked outbound ${approval.channel}; approval, ACTIVE mode, enabled provider, and verified configuration are required.`, { approvalId, systemMode: setting.mode });
        return blocked;
      }
      // No provider adapter is selected. Fail closed until a real, reviewed adapter exists.
      await audit(tx, "provider.blocked", `Blocked outbound ${approval.channel}; no provider adapter is configured.`, { approvalId });
      return tx.messageApproval.update({ where: { id: approvalId }, data: { status: "SENT_BLOCKED" } });
    });
  } catch (error) { return safeError(error, "process outbound message"); }
}

export async function runFollowUpScheduler() {
  try { const db = getPrisma(); const leads = await db.lead.findMany({ take: 10 }); let created = 0; await db.$transaction(async (tx) => { for (const lead of leads) { const title = `Follow up: ${lead.nextActionType}`; const exists = await tx.task.findUnique({ where: { leadId_title: { leadId: lead.id, title } } }); if (!exists) { await tx.task.create({ data: { leadId: lead.id, title, type: "SCHEDULED_FOLLOW_UP", priority: lead.priority, dueAt: lead.nextActionAt } }); created += 1; } } await audit(tx, "scheduler.followups", `Follow-up scheduler created ${created} task(s).`, { created }); }); return { created }; }
  catch (error) { return safeError(error, "run follow-up scheduler"); }
}
export async function recordWebhook(type: "message" | "call", payload: Record<string, unknown>) {
  try { await audit(getPrisma(), "webhook.received", `Received ${type} webhook.`, payload); } catch (error) { return safeError(error, "record webhook"); }
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value.trim()); value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function parseCsvRows(csvText: string) {
  const lines = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const headers = parseCsvLine(lines[0] ?? "").map((header) => header.trim());
  if (!headers.length || headers.every((header) => !header)) throw new Error("The CSV needs a header row.");
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function csvValue(row: Record<string, string>, ...headers: string[]) {
  for (const header of headers) {
    const direct = row[header]?.trim();
    if (direct) return direct;
    const match = Object.entries(row).find(([key, value]) => key.trim().toLowerCase() === header.toLowerCase() && value.trim());
    if (match) return match[1].trim();
  }
  return "";
}

function csvNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
}

function noteLines(entries: Array<[string, string]>) {
  return entries.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join("\n") || undefined;
}

export async function importDevelopersCsv(input: z.infer<typeof crmCsvImportSchema>) {
  const parsed = crmCsvImportSchema.parse(input);
  const rows = parseCsvRows(parsed.csvText);
  let created = 0; let skipped = 0;
  await getPrisma().$transaction(async (tx) => {
    for (const row of rows) {
      const companyName = csvValue(row, "Company Name", "Company", "Developer Name", "Developer", "Buyer Name", "Buyer");
      if (!companyName) { skipped += 1; continue; }
      const existing = await tx.developer.findUnique({ where: { companyName } });
      if (existing) { skipped += 1; continue; }
      const targetZipCodes = csvValue(row, "Target ZIP Codes", "Target ZIPs", "ZIP Codes", "ZIPs", "Zip Code", "ZIP").split(/[;,]/).map((zip) => zip.trim()).filter(Boolean);
      await tx.developer.create({ data: {
        companyName,
        contactName: csvValue(row, "Contact Name", "Acquisitions Contact") || undefined,
        phone: csvValue(row, "Phone", "Phone Number") || undefined,
        email: csvValue(row, "Email", "Email Address") || undefined,
        website: csvValue(row, "Website", "URL") || undefined,
        targetZipCodes: targetZipCodes.length ? targetZipCodes : ["Unknown"],
        maximumPurchasePrice: csvNumber(csvValue(row, "Maximum Purchase Price", "Max Purchase Price", "Maximum Price", "Max Price")),
        typicalBuildPrice: csvNumber(csvValue(row, "Typical Build Price", "Typical Finished Value", "Finished Value")),
        notes: noteLines([
          ["Buying status", csvValue(row, "Buying Status", "Status") || "Discovered"],
          ["Evidence level", csvValue(row, "Evidence Level", "Evidence") || "Unverified"],
          ["Property types", csvValue(row, "Property Types", "Property Type", "Asset Types", "Asset Type")],
          ["Target markets", csvValue(row, "Target Markets", "Markets", "Market")],
          ["Acreage range", csvValue(row, "Acreage Range", "Acreage")],
          ["Entitlement preference", csvValue(row, "Entitlement Preference", "Entitlement")],
          ["Utility requirements", csvValue(row, "Utility Requirements", "Utilities")],
          ["Preferred deal structure", csvValue(row, "Deal Structure", "Preferred Deal Structure")],
          ["Buy box source", csvValue(row, "Buy Box Source", "Source", "Source URL")],
          ["Last verified", csvValue(row, "Last Verified", "Verified Date")],
          ["Next follow-up", csvValue(row, "Next Follow-up", "Next Follow Up", "Follow-up Date")],
          ["Additional notes", csvValue(row, "Notes", "Additional Notes")],
        ]),
      } });
      created += 1;
    }
    await audit(tx, "csv.developers_imported", `Imported developer CSV: ${created} buyer(s) created, ${skipped} row(s) skipped.`, { sourceName: parsed.sourceName, rows: rows.length, created, skipped });
  });
  return { rows: rows.length, created, skipped };
}

export async function importPropertiesCsv(input: z.infer<typeof crmCsvImportSchema>) {
  const parsed = crmCsvImportSchema.parse(input);
  const rows = parseCsvRows(parsed.csvText);
  let created = 0; let skipped = 0;
  await getPrisma().$transaction(async (tx) => {
    for (const row of rows) {
      const address = csvValue(row, "Street Address", "Property Address", "Address");
      const city = csvValue(row, "City");
      const state = csvValue(row, "State").toUpperCase();
      const zipCode = csvValue(row, "Zip Code", "ZIP Code", "Zip", "ZIP");
      if (!address || !city || state.length !== 2 || zipCode.length < 5) { skipped += 1; continue; }
      const existing = await tx.property.findUnique({ where: { address_zipCode: { address, zipCode } } });
      if (existing) { skipped += 1; continue; }
      await tx.property.create({ data: {
        address, city, state, zipCode,
        ownerName: csvValue(row, "Owner1 Full Name", "Owner Full Name", "Owner Name", "Owner") || "Unknown Owner",
        yearBuilt: csvValue(row, "Year Built", "Year") || undefined,
        lotSize: csvValue(row, "Lot Size", "Acreage", "Acres") || undefined,
        estimatedValue: csvNumber(csvValue(row, "Estimated Value", "Asking Price", "List Price", "Price")),
        notes: noteLines([
          ["Source", csvValue(row, "Source", "Source URL") || parsed.sourceName || "CSV import"],
          ["Zoning", csvValue(row, "Zoning")],
          ["Utilities", csvValue(row, "Utilities")],
          ["Additional notes", csvValue(row, "Notes", "Additional Notes")],
        ]),
      } });
      created += 1;
    }
    await audit(tx, "csv.properties_imported", `Imported property CSV: ${created} propertie(s) created, ${skipped} row(s) skipped.`, { sourceName: parsed.sourceName, rows: rows.length, created, skipped });
  });
  return { rows: rows.length, created, skipped };
}

export async function importForeclosureCsv(input: z.infer<typeof foreclosureCsvImportSchema>) {
  const parsed = foreclosureCsvImportSchema.parse(input); const rows = parseCsvRows(parsed.csvText);
  let propertiesCreated = 0; let leadsCreated = 0; let skipped = 0;
  await getPrisma().$transaction(async (tx) => {
    for (const row of rows) {
      const address = row["Street Address"] || row["Property Address"] || row.Address; const city = row.City; const zipCode = row["Zip Code"] || row.Zip || row.ZIP;
      if (!address || !city || !zipCode) { skipped += 1; continue; }
      const ownerName = row["Owner1 Full Name"] || row["Owner Full Name"] || row["Owner Name"] || "Unknown Owner";
      const existing = await tx.property.findUnique({ where: { address_zipCode: { address, zipCode } } });
      const property = existing ?? await tx.property.create({ data: { address, city, state: (row.State || "TX").toUpperCase(), zipCode, ownerName, yearBuilt: row["Year Built"] || undefined, notes: parsed.sourceName ? `Source: ${parsed.sourceName}` : undefined } });
      if (!existing) propertiesCreated += 1;
      const lead = await tx.lead.findUnique({ where: { propertyId: property.id } });
      if (!lead) { const created = await tx.lead.create({ data: { propertyId: property.id, ownerName, status: "READY_TO_CONTACT", priority: row.Preforeclosure === "true" ? "High" : "Medium", nextActionType: "Research foreclosure lead and verify owner contact", nextActionAt: "Today" } }); await tx.task.create({ data: { leadId: created.id, title: created.nextActionType, type: "CSV_IMPORT_REVIEW", priority: created.priority, dueAt: created.nextActionAt } }); leadsCreated += 1; }
    }
    await audit(tx, "csv.foreclosure_imported", `Imported foreclosure CSV: ${propertiesCreated} propertie(s), ${leadsCreated} lead(s).`, { sourceName: parsed.sourceName, rows: rows.length, skipped });
  });
  return { rows: rows.length, propertiesCreated, leadsCreated, skipped };
}

export const __testables = { calculateMatches, parseCsvLine, parseCsvRows };
