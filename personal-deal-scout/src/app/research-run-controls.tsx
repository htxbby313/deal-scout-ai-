"use client";

import { useActionState } from "react";
import { researchDeveloperAction, researchPropertyAction, runResearchBacklogAction, type ResearchRunState } from "@/app/actions";

const initialState: ResearchRunState = { status: "idle", message: "" };

export function ResearchNowButton({ id, kind }: { id: string; kind: "property" | "developer" }) {
  const action = kind === "property" ? researchPropertyAction.bind(null, id) : researchDeveloperAction.bind(null, id);
  const [state, formAction, pending] = useActionState(action, initialState);
  return <form action={formAction} className="flex flex-col items-start gap-1 sm:items-end"><button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={pending}>{pending ? "Researching…" : "Research now"}</button>{state.message ? <span className={`max-w-64 text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{state.message}</span> : null}</form>;
}

export function RunBacklogButton() {
  const [state, formAction, pending] = useActionState(runResearchBacklogAction, initialState);
  return <form action={formAction} className="flex flex-col items-end gap-2"><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={pending}>{pending ? "Running…" : "Run backlog now"}</button>{state.message ? <span className={`text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{state.message}</span> : null}</form>;
}
