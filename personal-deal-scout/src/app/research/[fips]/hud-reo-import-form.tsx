"use client";

import { useActionState } from "react";
import { importHudReoCountyAction, type ResearchRunState } from "@/app/actions";

const initialState: ResearchRunState = { status: "idle", message: "" };

export function HudReoImportForm({ fips }: { fips: string }) {
  const actionForCounty = importHudReoCountyAction.bind(null, fips);
  const [state, action, pending] = useActionState(actionForCounty, initialState);
  return <form action={action} className="mt-4"><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={pending}>{pending ? "Finding HUD properties…" : "Find HUD properties"}</button>{state.message ? <p aria-live="polite" className={`mt-2 text-xs font-semibold ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}</form>;
}
