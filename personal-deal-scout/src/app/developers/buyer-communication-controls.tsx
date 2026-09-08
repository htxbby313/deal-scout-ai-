"use client";

import { useActionState } from "react";
import { recordBuyerResponseAction, setBuyerCommunicationsAction, type BuyerCommunicationState } from "@/app/buyer-communication-actions";

const initial: BuyerCommunicationState = { status: "idle", message: "" };
const Result = ({ state }: { state: BuyerCommunicationState }) => state.message ? <p className={`mt-2 text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{state.message}</p> : null;

export function BuyerCommunicationControls({ developerId, enabled }: { developerId: string; enabled: boolean }) {
  const [allowState, allow, allowing] = useActionState(setBuyerCommunicationsAction.bind(null, developerId, true), initial);
  const [pauseState, pause, pausing] = useActionState(setBuyerCommunicationsAction.bind(null, developerId, false), initial);
  const [responseState, recordResponse, recording] = useActionState(recordBuyerResponseAction.bind(null, developerId), initial);
  return <section className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="font-bold">Relationship communications</h3><p className="mt-1 text-sm text-slate-500">One direct setting for this buyer. New relationships start paused.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><form action={allow}><button className={`w-full rounded-lg px-3 py-2 text-sm font-bold ${enabled ? "bg-blue-700 text-white" : "border bg-white"}`} disabled={enabled || allowing}>{allowing ? "Saving…" : enabled ? "Allow communications · On" : "Allow communications"}</button><Result state={allowState} /></form><form action={pause}><button className={`w-full rounded-lg px-3 py-2 text-sm font-bold ${!enabled ? "bg-amber-600 text-white" : "border bg-white"}`} disabled={!enabled || pausing}>{pausing ? "Saving…" : !enabled ? "Pause communications · On" : "Pause communications"}</button><Result state={pauseState} /></form></div><form action={recordResponse} className="mt-5 grid gap-3"><h4 className="text-sm font-bold">Add buyer response</h4><select className="rounded-lg border px-3 py-2 text-sm" name="channel"><option value="EMAIL">Email</option><option value="SMS">Text</option><option value="PHONE">Phone</option><option value="MEETING">Meeting</option></select><textarea className="rounded-lg border px-3 py-2 text-sm" name="summary" placeholder="What did the buyer say?" required /><button className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={recording}>{recording ? "Saving…" : "Add to relationship history"}</button><Result state={responseState} /></form></section>;
}
