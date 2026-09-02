"use client";

import { useState } from "react";
import type { FormEvent } from "react";

const demoAddress = "2147 Oakview Drive";

export function DemoWorkflow() {
  const [leadAdded, setLeadAdded] = useState(false);
  const [query, setQuery] = useState("");
  const [followupSaved, setFollowupSaved] = useState(false);
  const [stageMoved, setStageMoved] = useState(false);
  const found = leadAdded && query.toLowerCase().includes("oakview");

  function addLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLeadAdded(true);
    setQuery(demoAddress);
  }

  return (
    <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5" aria-labelledby="demo-walkthrough">
      <h2 className="text-xl font-bold" id="demo-walkthrough">Try the workflow safely</h2>
      <p className="mt-1 text-sm text-blue-950">Every change below exists only in this browser tab and disappears when you leave demo.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={addLead}>
        <label className="grid gap-1 text-sm font-semibold"><span>Demo property address</span><input className="min-h-11 rounded-xl border bg-white px-3" defaultValue={demoAddress} name="demoAddress" required /></label>
        <button className="min-h-11 self-end rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white" type="submit">Add fictional lead</button>
      </form>
      {leadAdded ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
          <label className="grid gap-1 text-sm font-semibold"><span>Find a lead</span><input className="min-h-11 rounded-xl border px-3" onChange={(event) => setQuery(event.target.value)} type="search" value={query} /></label>
          {found ? <div className="mt-4" role="status"><div className="flex flex-wrap items-start justify-between gap-3"><div><b>{demoAddress}</b><p className="text-sm text-slate-500">Fictional Falls, TX · Contact ready</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Worth reviewing</span></div><p className="mt-3 text-sm">Reason: seller timing is known, the asking price is below the preliminary maximum, and property evidence is ready.</p><div className="mt-4 flex flex-wrap gap-3"><button className="min-h-11 rounded-xl border px-4 py-2 text-sm font-bold" onClick={() => setFollowupSaved(true)} type="button">Record demo follow-up</button><button className="min-h-11 rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white" onClick={() => setStageMoved(true)} type="button">Move to Contacting</button></div><p aria-live="polite" className="mt-3 text-sm font-semibold text-blue-800">{followupSaved ? "Demo follow-up recorded. " : ""}{stageMoved ? "Demo deal moved to Contacting." : ""}</p></div> : <p className="mt-3 text-sm text-slate-500">No fictional lead matches that search.</p>}
        </div>
      ) : null}
    </section>
  );
}
