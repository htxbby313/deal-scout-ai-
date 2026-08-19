"use client";

import { useActionState } from "react";
import { createTransactionAction, registerTransactionDocumentAction, setTransactionControlAction, type TransactionActionState } from "@/app/transaction-actions";

const initial: TransactionActionState = { status: "idle", message: "" };
function Result({ state }: { state: TransactionActionState }) { return state.message ? <p className={`text-xs ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`} role="status">{state.message}</p> : null; }

export function CreateTransactionForm({ properties, developers }: { properties: Array<{ id: string; address: string; city: string; state: string }>; developers: Array<{ id: string; companyName: string }> }) {
  const [state, action, pending] = useActionState(createTransactionAction, initial);
  return <form action={action} className="grid gap-3 md:grid-cols-3"><select className="rounded-xl border px-3 py-2.5 text-sm" name="propertyId" required><option value="">Select property</option>{properties.map((item) => <option key={item.id} value={item.id}>{item.address} · {item.city}, {item.state}</option>)}</select><select className="rounded-xl border px-3 py-2.5 text-sm" name="developerId"><option value="">Buyer not selected</option>{developers.map((item) => <option key={item.id} value={item.id}>{item.companyName}</option>)}</select><input className="rounded-xl border px-3 py-2.5 text-sm" min="0" name="targetSellerPrice" placeholder="Seller contract price" type="number" /><input className="rounded-xl border px-3 py-2.5 text-sm" min="0" name="targetBuyerPrice" placeholder="Buyer price" type="number" /><input className="rounded-xl border px-3 py-2.5 text-sm" min="0" name="targetAssignmentFee" placeholder="Target assignment fee" type="number" /><button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={pending}>{pending ? "Creating…" : "Create on hold"}</button><Result state={state} /></form>;
}

export function OwnerControls({ transactionId, stopped }: { transactionId: string; stopped: boolean }) {
  return <div className="grid gap-3 lg:grid-cols-3">{(["ACTIVE", "ON_HOLD", "STOPPED"] as const).map((control) => <ControlForm control={control} disabled={stopped} key={control} transactionId={transactionId} />)}</div>;
}
function ControlForm({ transactionId, control, disabled }: { transactionId: string; control: "ACTIVE" | "ON_HOLD" | "STOPPED"; disabled: boolean }) {
  const [state, action, pending] = useActionState(setTransactionControlAction.bind(null, transactionId, control), initial);
  const destructive = control === "STOPPED";
  return <form action={action} className={`rounded-xl border p-3 ${destructive ? "border-red-200 bg-red-50" : "bg-white"}`}><input className="w-full rounded-lg border bg-white px-3 py-2 text-sm" name="reason" placeholder={`${control.replace("_", " ")} reason`} required /><button className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50 ${destructive ? "bg-red-700" : "bg-slate-950"}`} disabled={disabled || pending}>{pending ? "Saving…" : control.replace("_", " ")}</button><Result state={state} /></form>;
}

export function RegisterDocumentForm({ transactionId, stopped }: { transactionId: string; stopped: boolean }) {
  const [state, action, pending] = useActionState(registerTransactionDocumentAction.bind(null, transactionId), initial);
  return <form action={action} className="grid gap-3 md:grid-cols-4"><input className="rounded-xl border px-3 py-2.5 text-sm" name="type" placeholder="Type: purchase agreement" required /><input className="rounded-xl border px-3 py-2.5 text-sm" name="title" placeholder="Document title" required /><input className="rounded-xl border px-3 py-2.5 text-sm" name="sourceUrl" placeholder="Secure document URL" type="url" required /><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={stopped || pending}>{pending ? "Registering…" : "Register document"}</button><Result state={state} /></form>;
}
