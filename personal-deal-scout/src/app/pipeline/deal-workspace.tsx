"use client";

import Link from "next/link";
import { useState } from "react";
import { humanLabel, VISIBLE_STAGE_ORDER, visibleStageFor, visibleStageLabel, type VisibleStage } from "@/lib/presentation";
import type { AcquisitionStageName } from "@/lib/acquisition-funnel";

export type DealSummary = {
  id: string;
  propertyId: string;
  property: string;
  market: string;
  stage: string;
  buyerCoverage: number;
  score: number | null;
  blockers: string[];
  reason: string;
};

function nextAction(deal: DealSummary) {
  if (deal.blockers.length) return humanLabel(deal.blockers[0]);
  if (deal.stage === "CLOSED") return "Review completed deal";
  return "Review next step";
}

function DealCard({ deal }: { deal: DealSummary }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-slate-950">{deal.property}</h3>
      <p className="mt-1 text-xs text-slate-500">{deal.market}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-slate-500">Projected spread</dt><dd className="mt-1 font-bold">{deal.score == null ? "Needs analysis" : `Priority ${deal.score}`}</dd></div>
        <div><dt className="text-slate-500">Buyer matches</dt><dd className="mt-1 font-bold">{deal.buyerCoverage || "None yet"}</dd></div>
      </dl>
      <p className="mt-4 text-xs text-slate-500">Next action</p>
      <p className="mt-1 text-sm font-semibold text-amber-800">{nextAction(deal)}</p>
      <Link className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white" href={`/deals/${deal.propertyId}`}>Open deal</Link>
    </article>
  );
}

export function DealWorkspace({ deals }: { deals: DealSummary[] }) {
  const [view, setView] = useState<"board" | "list">("board");
  const [query, setQuery] = useState("");
  const visibleDeals = deals.filter((deal) => `${deal.property} ${deal.market}`.toLowerCase().includes(query.trim().toLowerCase()));
  const grouped = new Map<VisibleStage, DealSummary[]>(VISIBLE_STAGE_ORDER.map((stage) => [stage, []]));
  for (const deal of visibleDeals) {
    const stage = visibleStageFor(deal.stage as AcquisitionStageName);
    if (stage) grouped.get(stage)?.push(deal);
  }
  const outcomes = visibleDeals.filter((deal) => !visibleStageFor(deal.stage as AcquisitionStageName));

  return (
    <section className="mt-6">
      <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Find a deal</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="deal-search">Search address, city, or ZIP</label>
          <input className="min-h-12 flex-1 rounded-xl border border-white/20 bg-white px-4 text-base text-slate-950 outline-none focus:ring-2 focus:ring-blue-400" id="deal-search" onChange={(event) => setQuery(event.target.value)} placeholder="Search address, city, or ZIP" type="search" value={query} />
          <span className="text-sm font-semibold text-slate-300">{visibleDeals.length} matching deal{visibleDeals.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="mt-6"><h2 className="text-xl font-bold">Active deals · {visibleDeals.length - outcomes.length}</h2><p className="mt-1 text-sm text-slate-500">Move from first review through closing without exposing internal stage codes.</p></div>
        <div className="flex rounded-xl border bg-white p-1" aria-label="Deal view">
          {(["board", "list"] as const).map((option) => <button aria-pressed={view === option} className={`rounded-lg px-3 py-2 text-sm font-bold ${view === option ? "bg-slate-950 text-white" : "text-slate-600"}`} key={option} onClick={() => setView(option)} type="button">{option === "board" ? "Board" : "List"}</button>)}
        </div>
      </div>
      {view === "board" ? (
        <div className="mt-5 grid gap-4 overflow-x-auto pb-2 lg:grid-cols-3 xl:grid-cols-6">
          {VISIBLE_STAGE_ORDER.map((stage) => <section className="min-w-[190px] rounded-2xl bg-slate-100 p-3" key={stage}><div className="flex items-center justify-between px-1"><h3 className="font-bold">{visibleStageLabel(stage)}</h3><span className="rounded-full bg-white px-2 py-1 text-xs font-bold">{grouped.get(stage)?.length ?? 0}</span></div><div className="mt-3 space-y-3">{grouped.get(stage)?.map((deal) => <DealCard deal={deal} key={deal.id} />)}</div></section>)}
        </div>
      ) : (
        <div className="mt-5 divide-y overflow-hidden rounded-2xl border bg-white">{visibleDeals.filter((deal) => visibleStageFor(deal.stage as AcquisitionStageName)).map((deal) => <div className="grid gap-3 p-4 md:grid-cols-[1.4fr_.7fr_.7fr_1fr_auto] md:items-center" key={deal.id}><div><b>{deal.property}</b><p className="text-xs text-slate-500">{deal.market}</p></div><span className="text-sm font-semibold">{humanLabel(deal.stage)}</span><span className="text-sm">{deal.buyerCoverage} buyers</span><span className="text-sm text-amber-800">{nextAction(deal)}</span><Link className="text-sm font-bold text-blue-700" href={`/deals/${deal.propertyId}`}>Open deal</Link></div>)}</div>
      )}
      {outcomes.length ? <details className="mt-4 rounded-xl border bg-white p-4"><summary className="cursor-pointer font-bold">Archived and disqualified · {outcomes.length}</summary><div className="mt-3 space-y-2">{outcomes.map((deal) => <Link className="block text-sm text-blue-700" href={`/deals/${deal.propertyId}`} key={deal.id}>{deal.property} · {humanLabel(deal.stage)}</Link>)}</div></details> : null}
    </section>
  );
}
