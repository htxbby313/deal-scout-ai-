"use client";

import { useActionState } from "react";
import { registerCreativeContractSetAction, type ContractActionState } from "./actions";

const initialState: ContractActionState = { status: "idle", message: "" };

export function ContractRegistrationForm() {
  const [state, action, pending] = useActionState(registerCreativeContractSetAction, initialState);
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <label className="text-sm font-semibold text-slate-700">Property state<input className="mt-1 w-full rounded-xl border px-3 py-2.5 uppercase" maxLength={2} minLength={2} name="jurisdictionState" placeholder="TX" required /></label>
    <label className="text-sm font-semibold text-slate-700">Supplied by<input className="mt-1 w-full rounded-xl border px-3 py-2.5" defaultValue="Coleman & Co. Holdings LLC" name="suppliedBy" required /></label>
    <button className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50 sm:col-span-2" disabled={pending}>{pending ? "Registering review copies…" : "Register exact drafts for legal review"}</button>
    {state.message ? <p className={`text-sm sm:col-span-2 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
  </form>;
}
