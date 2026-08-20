"use client";

import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { addPropertyMediaAction, researchPropertyAction, retirePropertyAction, reviewPropertyMediaAction, updatePropertyEvidenceAction, type EvidenceUpdateState, type ResearchRunState } from "@/app/actions";
import { propertyReadiness } from "@/lib/domain";
import { useThemeColor } from "@/lib/theme-color";
import { evaluateLuxuryRedevelopmentFit } from "@/lib/luxury-redevelopment";

export type PropertyView = {
  id: string; address: string; city: string; state: string; zipCode: string; ownerName: string; yearBuilt?: string; lotSize?: string; estimatedValue?: number; notes?: string;
  county?: string; neighborhood?: string; latitude?: number; longitude?: number;
  opportunityStatus: "NEEDS_VERIFICATION" | "DEVELOPMENT_SIGNAL" | "CONFIRMED_AVAILABLE" | "GOVERNMENT_SALE" | "REJECTED";
  contactName?: string; contactPhone?: string; contactEmail?: string; contactUrl?: string; sourceName?: string; sourceUrl?: string; sourceRecordDate?: string; verificationSourceUrl?: string; verificationDate?: string; lastVerifiedAt?: string; confidence: number;
  researchFindings: Array<{ id: string; topic: string; label: string; value?: string; status: "VERIFIED" | "NOT_FOUND" | "CONFLICT" | "NEEDS_MANUAL_VERIFICATION"; sourceName?: string; sourceUrl?: string; observedAt: string; confidence: number; notes?: string }>;
  media: Array<{ id: string; url: string; sourceUrl: string; sourceName: string; caption?: string; altText: string; sendApproved: boolean; discoveredAt: string }>;
  researchRuns: Array<{ id: string; status: string; sourcesChecked: number; findingsFound: number; manualNeeded: number; error?: string; startedAt: string; finishedAt?: string }>;
  matches: Array<{ developerId: string; companyName: string; score: number; reasons: string[] }>;
};

const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Value unknown";
const labels = { NEEDS_VERIFICATION: "Needs verification", DEVELOPMENT_SIGNAL: "Development signal", CONFIRMED_AVAILABLE: "Confirmed available", GOVERNMENT_SALE: "Government sale", REJECTED: "Rejected" };
const actionable = (property: PropertyView) => propertyReadiness(property).actionable;
const sourceImageLoader = ({ src }: { src: string }) => src;
const PropertyMap = dynamic(() => import("@/app/properties/property-map"), { ssr: false });

function ResearchPanel({ property }: { property: PropertyView }) {
  const boundAction = researchPropertyAction.bind(null, property.id);
  const [state, action, pending] = useActionState(boundAction, { status: "idle", message: "" } satisfies ResearchRunState);
  const manual = property.researchFindings.filter((finding) => finding.status !== "VERIFIED").length;
  return <section className="mt-7 border-t pt-6">
    <div className="flex items-start justify-between gap-4"><div><h3 className="font-bold">Property details</h3><p className="mt-1 text-xs leading-5 text-slate-500">Public sources are checked automatically. Missing noncritical details do not remove an opportunity from consideration.</p></div><form action={action}><button className="whitespace-nowrap rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60" disabled={pending}>{pending ? "Finding details…" : property.researchRuns.length ? "Refresh research" : "Research property"}</button></form></div>
    {state.message ? <p aria-live="polite" className={`mt-3 text-xs font-semibold ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
    {property.researchRuns[0] ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Latest run: {property.researchRuns[0].status === "COMPLETE" ? "usable research" : "more evidence needed"} · {property.researchRuns[0].findingsFound} verified · {property.researchRuns[0].manualNeeded} additional details unavailable · {property.researchRuns[0].sourcesChecked} sources checked</p> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Automatic public-source research starts when the property is added.</p>}
    <div className="mt-4 grid gap-2 sm:grid-cols-2">{property.researchFindings.map((finding) => <article className={`rounded-xl border p-3 ${finding.status === "VERIFIED" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`} key={finding.id}><p className="text-[11px] font-bold uppercase tracking-wide">{finding.status === "VERIFIED" ? "Verified" : finding.status === "CONFLICT" ? "Conflicting evidence" : "Not available yet"}</p><b className="mt-1 block text-sm">{finding.label}</b>{finding.value ? <p className="mt-1 text-xs">{finding.value}</p> : null}{finding.sourceUrl ? <a className="mt-2 block text-xs font-bold text-blue-700 underline" href={finding.sourceUrl} rel="noreferrer" target="_blank">Open source</a> : null}</article>)}</div>
    {manual ? <p className="mt-3 text-xs text-slate-600">{manual} additional research topic{manual === 1 ? " is" : "s are"} still being pursued. This alone does not disqualify the opportunity.</p> : null}
  </section>;
}

function PhotoPanel({ property }: { property: PropertyView }) {
  return <section className="mt-7 border-t pt-6"><h3 className="font-bold">Developer photo package</h3><p className="mt-1 text-xs leading-5 text-slate-500">Found images retain attribution. Approve only after confirming the subject and permission to share.</p>
    {property.media.length ? <div className="mt-4 grid grid-cols-2 gap-3">{property.media.map((item) => <article className="overflow-hidden rounded-xl border" key={item.id}><Image alt={item.altText} className="h-32 w-full bg-slate-100 object-cover" height={256} loader={sourceImageLoader} referrerPolicy="no-referrer" src={item.url} unoptimized width={480} /><div className="p-3"><a className="block truncate text-xs font-bold text-blue-700 underline" href={item.sourceUrl} rel="noreferrer" target="_blank">Source: {item.sourceName}</a><form action={reviewPropertyMediaAction} className="mt-3"><input name="propertyId" type="hidden" value={property.id} /><input name="mediaId" type="hidden" value={item.id} /><input name="approved" type="hidden" value={item.sendApproved ? "false" : "true"} /><button className={`w-full rounded-lg px-2 py-2 text-xs font-bold ${item.sendApproved ? "bg-emerald-700 text-white" : "bg-amber-100 text-amber-900"}`}>{item.sendApproved ? "Approved for developer ✓" : "Review and approve"}</button></form></div></article>)}</div> : <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">No verified photo found through integrated sources. Needs manual verification.</p>}
    <details className="mt-4 rounded-xl border p-3"><summary className="cursor-pointer text-xs font-bold">Add a sourced photo manually</summary><form action={addPropertyMediaAction} className="mt-3 grid gap-2"><input name="propertyId" type="hidden" value={property.id} /><input className="rounded-lg border px-3 py-2 text-xs" name="url" placeholder="Direct HTTPS image URL" required type="url" /><input className="rounded-lg border px-3 py-2 text-xs" name="sourceUrl" placeholder="Page proving where the image came from" required type="url" /><input className="rounded-lg border px-3 py-2 text-xs" name="sourceName" placeholder="Source name" required /><input className="rounded-lg border px-3 py-2 text-xs" name="caption" placeholder="Caption or view" /><button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">Save unapproved photo</button></form></details>
  </section>;
}

function EvidenceForm({ property }: { property: PropertyView }) {
  const boundAction = updatePropertyEvidenceAction.bind(null, property.id);
  const [state, action, pending] = useActionState(boundAction, { status: "idle", message: "" } satisfies EvidenceUpdateState);
  return <details className="mt-7 rounded-xl border border-slate-200 p-4">
    <summary className="cursor-pointer text-sm font-bold text-slate-700">Correct or add a missing result</summary>
    <p className="mt-2 text-xs leading-5 text-slate-500">Use this only when you have newer source evidence than the automatic research found.</p>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.estimatedValue || ""} min="1" name="estimatedValue" placeholder="Current asking price" required type="number" />
      <select className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={["CONFIRMED_AVAILABLE", "GOVERNMENT_SALE"].includes(property.opportunityStatus) ? property.opportunityStatus : "CONFIRMED_AVAILABLE"} name="opportunityStatus"><option value="CONFIRMED_AVAILABLE">Confirmed available</option><option value="GOVERNMENT_SALE">Government sale</option></select>
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.contactName} name="contactName" placeholder="Broker or seller contact" required />
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.contactPhone} name="contactPhone" placeholder="Contact phone" />
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.contactEmail} name="contactEmail" placeholder="Contact email" type="email" />
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.confidence || ""} max="100" min="1" name="confidence" placeholder="Confidence 1–100" required type="number" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationSourceUrl} name="verificationSourceUrl" placeholder="Price/contact evidence URL" required type="url" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.contactUrl} name="contactUrl" placeholder="Official contact or listing page" type="url" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationDate} name="verificationDate" required type="date" />
      <textarea className="min-h-24 rounded-xl border p-3 text-sm sm:col-span-2" defaultValue={property.notes} name="notes" placeholder="Verification notes and contact context" />
      <button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={pending}>{pending ? "Updating property…" : "Save property details"}</button>
      {state.message ? <p aria-live="polite" className={`text-xs font-semibold sm:col-span-2 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
    </form>
  </details>;
}

function RetirementForm({ property }: { property: PropertyView }) {
  const boundAction = retirePropertyAction.bind(null, property.id);
  const [state, action, pending] = useActionState(boundAction, { status: "idle", message: "" } satisfies EvidenceUpdateState);
  return <details className="mt-7 rounded-xl border border-red-200 bg-red-50 p-4">
    <summary className="cursor-pointer font-bold text-red-900">Remove from active properties</summary>
    <p className="mt-2 text-xs leading-5 text-red-800">Use contradictory or closing evidence to remove a property from matching without deleting its source history.</p>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <select className="rounded-xl border px-3 py-2.5 text-sm" name="retirementReason"><option value="OFF_MARKET">Off market</option><option value="SOLD">Sold</option><option value="SOURCE_CONFLICT">Source conflict</option><option value="DUPLICATE">Duplicate</option><option value="OTHER">Other</option></select>
      <input className="rounded-xl border px-3 py-2.5 text-sm" defaultValue={property.confidence || ""} max="100" min="1" name="confidence" placeholder="Confidence 1–100" required type="number" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationSourceUrl} name="verificationSourceUrl" placeholder="Contradictory or closing evidence URL" required type="url" />
      <input className="rounded-xl border px-3 py-2.5 text-sm sm:col-span-2" defaultValue={property.verificationDate} name="verificationDate" required type="date" />
      <textarea className="min-h-24 rounded-xl border p-3 text-sm sm:col-span-2" defaultValue={property.notes} name="notes" placeholder="Explain why the property is no longer actionable" required />
      <button className="rounded-xl bg-red-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2" disabled={pending}>{pending ? "Removing property…" : "Remove property"}</button>
      {state.message ? <p aria-live="polite" className={`text-xs font-semibold sm:col-span-2 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
    </form>
  </details>;
}

export function PropertyBrowser({ properties }: { properties: PropertyView[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"actionable" | "research">("actionable");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [sort, setSort] = useState("luxury-fit");
  const mapColor = useThemeColor();
  const rankCategory = sort === "luxury-fit" ? "Luxury redevelopment fit" : sort === "confidence" ? "Highest confidence" : sort === "price-asc" ? "Lowest price" : sort === "price-desc" ? "Highest price" : sort === "address" ? "Address A–Z" : "Most researched";
  const states = useMemo(() => [...new Set(properties.map((property) => property.state))].sort(), [properties]);
  const counties = useMemo(() => [...new Set(properties.filter((property) => !state || property.state === state).map((property) => property.county).filter(Boolean) as string[])].sort(), [properties, state]);
  const neighborhoods = useMemo(() => [...new Set(properties.filter((property) => (!state || property.state === state) && (!county || property.county === county)).map((property) => property.neighborhood).filter(Boolean) as string[])].sort(), [properties, state, county]);
  const filtered = useMemo(() => properties.filter((property) => (view === "actionable" ? actionable(property) : !actionable(property)) && (!state || property.state === state) && (!county || property.county === county) && (!neighborhood || property.neighborhood === neighborhood) && [property.address, property.city, property.state, property.zipCode, property.county, property.neighborhood, property.ownerName, property.contactName, property.sourceName].filter(Boolean).some((value) => value?.toLowerCase().includes(query.toLowerCase()))).toSorted((a, b) => { if (sort === "luxury-fit") return evaluateLuxuryRedevelopmentFit(b).score - evaluateLuxuryRedevelopmentFit(a).score; if (sort === "price-asc") return (a.estimatedValue ?? Number.MAX_SAFE_INTEGER) - (b.estimatedValue ?? Number.MAX_SAFE_INTEGER); if (sort === "price-desc") return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0); if (sort === "address") return a.address.localeCompare(b.address); if (sort === "confidence") return b.confidence - a.confidence; return b.researchFindings.filter((item) => item.status === "VERIFIED").length - a.researchFindings.filter((item) => item.status === "VERIFIED").length; }), [properties, query, view, state, county, neighborhood, sort]);
  const selected = properties.find((property) => property.id === selectedId);
  const actionableCount = properties.filter(actionable).length;

  return <>
    <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(130px,auto))]"><input className="min-w-0 rounded-xl border bg-slate-50 px-4 py-2.5 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="Search address, region, contact, source…" value={query} /><select aria-label="State" className="rounded-xl border px-3 py-2 text-sm" onChange={(event) => { setState(event.target.value); setCounty(""); setNeighborhood(""); }} value={state}><option value="">United States · all states</option>{states.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="County" className="rounded-xl border px-3 py-2 text-sm" onChange={(event) => { setCounty(event.target.value); setNeighborhood(""); }} value={county}><option value="">All counties</option>{counties.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Neighborhood" className="rounded-xl border px-3 py-2 text-sm" onChange={(event) => setNeighborhood(event.target.value)} value={neighborhood}><option value="">All neighborhoods</option>{neighborhoods.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Sort properties" className="rounded-xl border px-3 py-2 text-sm" onChange={(event) => setSort(event.target.value)} value={sort}><option value="luxury-fit">Luxury redevelopment fit</option><option value="research-desc">Most researched</option><option value="confidence">Highest confidence</option><option value="price-asc">Price low to high</option><option value="price-desc">Price high to low</option><option value="address">Address A–Z</option></select></div><div className="mt-3 flex flex-wrap items-center gap-3"><div className="flex rounded-xl border p-1"><button className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === "actionable" ? "bg-slate-950 text-white" : "text-slate-500"}`} onClick={() => setView("actionable")}>Actionable · {actionableCount}</button><button className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${view === "research" ? "bg-amber-600 text-white" : "text-slate-500"}`} onClick={() => setView("research")}>Needs verification · {properties.length - actionableCount}</button></div></div><p className="mt-3 text-xs text-slate-500">United States → {state || "state"} → {county || "county"} → {neighborhood || "neighborhood"} → {filtered.length} address{filtered.length === 1 ? "" : "es"} · ranks reflect {rankCategory}</p></div>
    <div className="mt-5"><PropertyMap baseColor={mapColor} onSelect={setSelectedId} properties={filtered} rankCategory={rankCategory} /></div>
    <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((property, index) => <button className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={property.id} onClick={() => setSelectedId(property.id)}><div className="relative grid min-h-40 place-items-center overflow-hidden bg-slate-100">{property.media[0] ? <Image alt={property.media[0].altText} className="object-cover" fill loader={sourceImageLoader} referrerPolicy="no-referrer" sizes="(min-width: 1536px) 33vw, (min-width: 768px) 50vw, 100vw" src={property.media[0].url} unoptimized /> : <><span className="text-5xl opacity-40">⌂</span><span className="absolute bottom-3 right-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">Photo needs verification</span></>}<span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold">#{index + 1} · {rankCategory}</span><span className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-bold">{labels[property.opportunityStatus]}</span></div><div className="p-5"><div className="flex justify-between gap-3"><div><h2 className="font-bold">{property.address}</h2><p className="mt-1 text-sm text-slate-500">{property.city}, {property.state} {property.zipCode}</p></div><span className="h-fit rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800">{property.matches.length} matches</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">Value</span><b>{money(property.estimatedValue)}</b></span><span className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-500">Research</span><b>{property.researchFindings.filter((item) => item.status === "VERIFIED").length}/12 verified</b></span></div><p className="mt-4 text-sm font-semibold text-blue-700">Open dossier →</p></div></button>)}</div>
    {!filtered.length ? <p className="mt-5 rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-slate-500">{view === "actionable" ? "No properties meet the actionable standard yet." : "No properties need verification."}</p> : null}
    {selected ? <div className="fixed inset-0 z-50 bg-slate-950/40 p-3 sm:p-6" onClick={() => setSelectedId(null)}><aside aria-modal="true" className="ml-auto h-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog"><div className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">Property evidence</p><h2 className="mt-1 text-xl font-bold">{selected.address}</h2></div><button aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-xl" onClick={() => setSelectedId(null)}>×</button></div><div className="p-5">
      <section className={`rounded-xl p-4 ${actionable(selected) ? "bg-emerald-50 text-emerald-900" : selected.opportunityStatus === "REJECTED" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900"}`}><b>{actionable(selected) ? "Disposition ready" : selected.opportunityStatus === "REJECTED" ? "Retired from pipeline" : "Verification required"}</b>{!actionable(selected) && selected.opportunityStatus !== "REJECTED" ? <p className="mt-2 text-xs">Missing: {propertyReadiness(selected).missing.join(", ")}.</p> : null}</section>
      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">{[["Location", `${selected.city}, ${selected.state} ${selected.zipCode}`], ["Owner", selected.ownerName], ["Status", labels[selected.opportunityStatus]], ["Confidence", `${selected.confidence}%`], ["Contact", selected.contactName || "Missing"], ["Phone", selected.contactPhone || "Missing"], ["Email", selected.contactEmail || "Missing"], ["Record date", selected.sourceRecordDate || "Missing"]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 font-bold">{value}</dd></div>)}</dl>
      <section className="mt-7 rounded-xl bg-slate-50 p-4"><h3 className="font-bold">Evidence chain</h3>{selected.sourceUrl ? <a className="mt-2 block text-sm font-bold text-blue-700 underline" href={selected.sourceUrl} rel="noreferrer" target="_blank">Open original {selected.sourceName || "official record"}</a> : <p className="mt-2 text-sm text-red-700">No original source URL recorded.</p>}{selected.verificationSourceUrl ? <a className="mt-3 block text-sm font-bold text-blue-700 underline" href={selected.verificationSourceUrl} rel="noreferrer" target="_blank">Open price/contact verification</a> : null}</section>
      <PhotoPanel property={selected} />
      <ResearchPanel property={selected} />
      <EvidenceForm property={selected} />
      <RetirementForm property={selected} />
      <section className="mt-7"><h3 className="font-bold">Developer matches</h3><div className="mt-3 space-y-3">{selected.matches.map((match) => <article className="rounded-xl border p-4" key={match.developerId}><div className="flex justify-between"><b>{match.companyName}</b><b className="text-blue-700">{match.score}</b></div><p className="mt-2 text-xs leading-5 text-slate-500">{match.reasons.join(" ")}</p></article>)}{!selected.matches.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Matching stays locked until every evidence requirement and developer qualification pass.</p> : null}</div></section>
    </div></aside></div> : null}
  </>;
}
