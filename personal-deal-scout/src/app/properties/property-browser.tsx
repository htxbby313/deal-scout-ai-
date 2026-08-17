"use client";

import { useActionState, useMemo, useState } from "react";
import { retirePropertyAction, updatePropertyEvidenceAction, type EvidenceUpdateState } from "@/app/actions";
import { propertyReadiness } from "@/lib/domain";

export type PropertyView = {
  id: string; address: string; city: string; state: string; zipCode: string; ownerName: string; yearBuilt?: string; lotSize?: string; estimatedValue?: number; notes?: string;
  opportunityStatus: "NEEDS_VERIFICATION" | "DEVELOPMENT_SIGNAL" | "CONFIRMED_AVAILABLE" | "GOVERNMENT_SALE" | "REJECTED";
  contactName?: string; contactPhone?: string; contactEmail?: string; sourceName?: string; sourceUrl?: string; sourceRecordDate?: string; verificationSourceUrl?: string; verificationDate?: string; lastVerifiedAt?: string; confidence: number;
  matches: Array<{ developerId: string; companyName: string; score: number; reasons: string[] }>;
};

const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Value unknown";
const labels = { NEEDS_VERIFICATION: "Needs verification", DEVELOPMENT_SIGNAL: "Development signal", CONFIRMED_AVAILABLE: "Confirmed available", GOVERNMENT_SALE: "Government sale", REJECTED: "Rejected" };
const actionable = (property: PropertyView) => propertyReadiness(property).actionable;

function EvidenceForm({ property }: { property: PropertyView }) {
  const boundAction = updatePropertyEvidenceAction.bind(null, property.id);
  const [state, action, pending] = useActionState(boundAction, { status: "idle", message: "" } satisfies EvidenceUpdateState);
  return <section className="mt-7 border-t pt-6">
    <h3 className="font-bold">Verify price and seller contact</h3>
    <p className="mt-1 text-xs leading-5 text-slate-500">The original source remains unchanged. Add a separate URL that proves the current price and contact details.</p>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.estimatedValue || ""} min="1" name="estimatedValue" placeholder="Current asking price" required type="number" />
      <select className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={["CONFIRMED_AVAILABLE", "GOVERNMENT_SALE"].includes(property.opportunityStatus) ? property.opportunityStatus : "CONFIRMED_AVAILABLE"} name="opportunityStatus"><option value="CONFIRMED_AVAILABLE">Confirmed available</option><option value="GOVERNMENT_SALE">Government sale</option></select>
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.contactName} name="contactName" placeholder="Broker or seller contact" required />
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.contactPhone} name="contactPhone" placeholder="Contact phone" />
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.contactEmail} name="contactEmail" placeholder="Contact email" type="email" />
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.confidence || ""} max="100" min="1" name="confidence" placeholder="Confidence 1–100" required type="number" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationSourceUrl} name="verificationSourceUrl" placeholder="Price/contact evidence URL" required type="url" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationDate} name="verificationDate" required type="date" />
      <textarea className="min-h-24 rounded-xl border p-3 text-sm sm:col-span-2" defaultValue={property.notes} name="notes" placeholder="Verification notes and contact context" />
      <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={pending}>{pending ? "Recalculating readiness…" : "Save verified evidence"}</button>
      {state.message ? <p aria-live="polite" className={`text-xs font-semibold sm:col-span-2 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
    </form>
  </section>;
}

function RetirementForm({ property }: { property: PropertyView }) {
  const boundAction = retirePropertyAction.bind(null, property.id);
  const [state, action, pending] = useActionState(boundAction, { status: "idle", message: "" } satisfies EvidenceUpdateState);
  return <details className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4">
    <summary className="cursor-pointer font-bold text-red-900">Retire stale or unavailable property</summary>
    <p className="mt-2 text-xs leading-5 text-red-800">Use contradictory or closing evidence to remove a property from matching without deleting its source history.</p>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <select className="rounded-xl border px-3 py-2.5 text-sm" name="retirementReason"><option value="OFF_MARKET">Off market</option><option value="SOLD">Sold</option><option value="SOURCE_CONFLICT">Source conflict</option><option value="DUPLICATE">Duplicate</option><option value="OTHER">Other</option></select>
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.confidence || ""} max="100" min="1" name="confidence" placeholder="Confidence 1–100" required type="number" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationSourceUrl} name="verificationSourceUrl" placeholder="Contradictory or closing evidence URL" required type="url" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationDate} name="verificationDate" required type="date" />
      <textarea className="min-h-24 rounded-xl border p-3 text-sm sm:col-span-2" defaultValue={property.notes} name="notes" placeholder="Explain why the property is no longer actionable" required />
      <button className="rounded-xl bg-red-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={pending}>{pending ? "Retiring property…" : "Retire with evidence"}</button>
      {state.message ? <p aria-live="polite" className={`text-xs font-semibold sm:col-span-2 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
    </form>
  </details>;
}

export function PropertyBrowser({ properties }: { properties: PropertyView[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"actionable" | "research">("actionable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = useMemo(() => properties.filter((property) => (view === "actionable" ? actionable(property) : !actionable(property)) && [property.address, property.city, property.state, property.zipCode, property.ownerName, property.contactName, property.sourceName].filter(Boolean).some((value) => value?.toLowerCase().includes(query.toLowerCase()))), [properties, query, view]);
  const selected = properties.find((property) => property.id === selectedId);
  const actionableCount = properties.filter(actionable).length;

  return <>
    <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row"><input className="min-w-0 flex-1 rounded-xl border bg-slate-50 px-4 py-2.5 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Search address, city, contact, source…" value={query} /><div className="flex rounded-xl border p-1"><button className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === "actionable" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setView("actionable")}>Actionable · {actionableCount}</button><button className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === "research" ? "bg-amber-600 text-white" : "text-slate-500"}`} onClick={() => setView("research")}>Needs verification · {properties.length - actionableCount}</button></div></div></div>
    <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((property, index) => <button className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={property.id} onClick={() => setSelectedId(property.id)}><div className={`relative grid min-h-40 place-items-center bg-gradient-to-br ${index % 3 === 0 ? "from-blue-100 to-slate-200" : index % 3 === 1 ? "from-amber-100 to-orange-100" : "from-emerald-100 to-slate-200"}`}><span className="text-5xl opacity-60">⌂</span><span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold">{labels[property.opportunityStatus]}</span></div><div className="p-5"><div className="flex justify-between gap-3"><div><h2 className="font-bold">{property.address}</h2><p className="mt-1 text-sm text-slate-500">{property.city}, {property.state} {property.zipCode}</p></div><span className="h-fit rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{property.matches.length} matches</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">Value</span><b>{money(property.estimatedValue)}</b></span><span className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">Confidence</span><b>{property.confidence}%</b></span></div><p className="mt-4 text-sm font-semibold text-blue-700">Open evidence →</p></div></button>)}</div>
    {!filtered.length ? <p className="mt-5 rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">{view === "actionable" ? "No properties meet the actionable standard yet." : "No properties need verification."}</p> : null}
    {selected ? <div className="fixed inset-0 z-50 bg-slate-950/40 p-3 sm:p-6" onClick={() => setSelectedId(null)}><aside aria-modal="true" className="ml-auto h-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog"><div className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Property evidence</p><h2 className="mt-1 text-xl font-bold">{selected.address}</h2></div><button aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl" onClick={() => setSelectedId(null)}>×</button></div><div className="p-5">
      <section className={`rounded-xl p-4 ${actionable(selected) ? "bg-emerald-50 text-emerald-900" : selected.opportunityStatus === "REJECTED" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}><b>{actionable(selected) ? "Disposition ready" : selected.opportunityStatus === "REJECTED" ? "Retired from pipeline" : "Verification required"}</b>{!actionable(selected) && selected.opportunityStatus !== "REJECTED" ? <p className="mt-2 text-xs">Missing: {propertyReadiness(selected).missing.join(", ")}.</p> : null}</section>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">{[["Location", `${selected.city}, ${selected.state} ${selected.zipCode}`], ["Owner", selected.ownerName], ["Status", labels[selected.opportunityStatus]], ["Confidence", `${selected.confidence}%`], ["Contact", selected.contactName || "Missing"], ["Phone", selected.contactPhone || "Missing"], ["Email", selected.contactEmail || "Missing"], ["Record date", selected.sourceRecordDate || "Missing"]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl>
      <section className="mt-7 rounded-xl bg-slate-50 p-4"><h3 className="font-bold">Evidence chain</h3>{selected.sourceUrl ? <a className="mt-2 block text-sm font-bold text-blue-700 underline" href={selected.sourceUrl} rel="noreferrer" target="_blank">Open original {selected.sourceName || "official record"}</a> : <p className="mt-2 text-sm text-red-700">No original source URL recorded.</p>}{selected.verificationSourceUrl ? <a className="mt-3 block text-sm font-bold text-blue-700 underline" href={selected.verificationSourceUrl} rel="noreferrer" target="_blank">Open price/contact verification</a> : null}</section>
      <EvidenceForm property={selected} />
      <RetirementForm property={selected} />
      <section className="mt-7"><h3 className="font-bold">Developer matches</h3><div className="mt-3 space-y-3">{selected.matches.map((match) => <article className="rounded-xl border p-4" key={match.developerId}><div className="flex justify-between"><b>{match.companyName}</b><b className="text-blue-700">{match.score}</b></div><p className="mt-2 text-xs leading-5 text-slate-500">{match.reasons.join(" ")}</p></article>)}{!selected.matches.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Matching stays locked until every evidence requirement and developer qualification pass.</p> : null}</div></section>
    </div></aside></div> : null}
  </>;
}
