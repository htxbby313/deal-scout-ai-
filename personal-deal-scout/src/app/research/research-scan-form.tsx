"use client";

import { useActionState } from "react";
import { runCensusPermitResearchAction, type ResearchRunState } from "@/app/actions";

const initialState: ResearchRunState = { status: "idle", message: "" };

export function ResearchScanForm() {
  const [state, action, pending] = useActionState(runCensusPermitResearchAction, initialState);
  return <form action={action}><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={pending}>{pending ? "Finding developing markets…" : "Find developing markets"}</button>{state.message ? <p aria-live="polite" className={`mt-2 max-w-md text-xs font-semibold ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}</form>;
}
