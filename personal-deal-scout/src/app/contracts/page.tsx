import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { evaluateContractTemplateActivation } from "@/lib/contract-template-policy";
import { readContractTemplateVersions } from "@/lib/contract-template-registry";
import { ContractRegistrationForm } from "./contract-registration-form";

export const dynamic = "force-dynamic";

function date(value?: Date | null) { return value ? value.toLocaleString() : "Not recorded"; }

export default async function ContractsPage() {
  await requireOwner();
  const templates = await readContractTemplateVersions();
  return <WorkspaceShell active="contracts"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <header className="border-b pb-6"><p className="text-sm font-semibold text-blue-700">User-supplied legal artifacts</p><h1 className="mt-1 text-3xl font-bold">Contract review registry</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">The submitted acquisition and assignment wording is preserved exactly. Registration proves provenance and version hash only; it does not authorize use, delivery, signature, closing, or legal conclusions.</p></header>
    <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">Register the draft set by property state</h2><p className="mb-4 mt-1 text-sm text-slate-600">Each state gets a separate immutable review version. Re-registering identical content is idempotent.</p><ContractRegistrationForm /></section>
    <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-bold text-amber-950">Activation remains blocked</h2><p className="mt-1 text-sm text-amber-900">The exact state, current counsel review, closing/title review, owner approval, effective dates, and provider readiness must be recorded for this exact artifact version. Creative-financing, due-on-sale, deed-in-lieu, forfeiture, assignment, marketing, disclosure, servicing, and settlement instructions require transaction-specific review.</p></section>
    <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-5"><h2 className="text-xl font-bold">Registered versions</h2></div><div className="divide-y">{templates.map((template) => {
      const decision = evaluateContractTemplateActivation({ ...template, requestedJurisdictionState: template.jurisdictionState, artifactLocated: Boolean(template.storageKey || template.sourceUrl) });
      return <article className="grid gap-3 p-5 md:grid-cols-[1fr_auto]" key={template.id}><div><div className="flex flex-wrap items-center gap-2"><b>{template.name}</b><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{template.status}</span></div><p className="mt-1 text-sm text-slate-600">{template.jurisdictionState} · {template.type.replaceAll("_", " ")} · version {template.version}</p><p className="mt-1 break-all font-mono text-xs text-slate-500">SHA-256: {template.artifactHash ?? "No artifact"}</p><p className="mt-2 text-xs text-slate-500">Supplied: {date(template.userSuppliedAt)} · Counsel: {date(template.counselApprovedAt)} · Owner: {date(template.ownerApprovedAt)}</p></div><div className="md:max-w-sm"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current blockers</p><ul className="mt-1 list-disc pl-5 text-sm text-slate-700">{decision.blockers.map((blocker) => <li key={blocker}>{blocker.replaceAll("_", " ")}</li>)}</ul></div></article>;
    })}{!templates.length ? <p className="p-8 text-center text-slate-500">No contract artifacts have been registered yet.</p> : null}</div></section>
  </div></WorkspaceShell>;
}
