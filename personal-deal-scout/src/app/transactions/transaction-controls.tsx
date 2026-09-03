"use client";

import { useActionState } from "react";
import { advanceTransactionAction, createTransactionAction, decideApprovalAction, executeDocumentAction, recordLegalReviewAction, registerProfessionalDiligenceAction, registerTransactionDocumentAction, requestApprovalAction, setTransactionControlAction, type TransactionActionState } from "@/app/transaction-actions";

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

export function LegalReviewForm({ transactionId, stopped }: { transactionId: string; stopped: boolean }) {
  const [counselState, counselAction, counselPending] = useActionState(recordLegalReviewAction.bind(null, transactionId, "COUNSEL"), initial);
  const [complianceState, complianceAction, compliancePending] = useActionState(recordLegalReviewAction.bind(null, transactionId, "COMPLIANCE"), initial);
  return <div className="grid gap-3 md:grid-cols-2"><form action={counselAction} className="rounded-xl border p-3"><input className="w-full rounded-lg border px-3 py-2 text-sm" name="reason" placeholder="Counsel approval reason" required /><button className="mt-2 w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={stopped || counselPending}>{counselPending ? "Saving…" : "Record counsel"}</button><Result state={counselState} /></form><form action={complianceAction} className="rounded-xl border p-3"><input className="w-full rounded-lg border px-3 py-2 text-sm" name="reason" placeholder="Compliance verification reason" required /><button className="mt-2 w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={stopped || compliancePending}>{compliancePending ? "Saving…" : "Record compliance"}</button><Result state={complianceState} /></form></div>;
}

export function RequestApprovalForm({ transactionId, stopped }: { transactionId: string; stopped: boolean }) {
  const [state, action, pending] = useActionState(requestApprovalAction.bind(null, transactionId), initial);
  return <form action={action} className="grid gap-3 md:grid-cols-3"><select className="rounded-xl border px-3 py-2.5 text-sm" name="type" required>{["OFFER","CONTRACT","ASSIGNMENT_MARKETING","ASSIGNMENT","BUYER_CONTACT","EARNEST_MONEY","CLOSING_INSTRUCTION"].map((type) => <option key={type}>{type}</option>)}</select><input className="rounded-xl border px-3 py-2.5 text-sm" name="reason" placeholder="Approval reason" /><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={stopped || pending}>{pending ? "Requesting…" : "Request approval"}</button><Result state={state} /></form>;
}

export function DecideApprovalForm({ approvalId, stopped }: { approvalId: string; stopped: boolean }) {
  const [approveState, approveAction, approvePending] = useActionState(decideApprovalAction.bind(null, approvalId, "APPROVED"), initial);
  const [rejectState, rejectAction, rejectPending] = useActionState(decideApprovalAction.bind(null, approvalId, "REJECTED"), initial);
  return <div className="mt-2 grid gap-2 sm:grid-cols-2"><form action={approveAction}><input className="w-full rounded-lg border px-3 py-2 text-sm" name="reason" placeholder="Approve reason" required /><button className="mt-1 w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={stopped || approvePending}>Approve</button><Result state={approveState} /></form><form action={rejectAction}><input className="w-full rounded-lg border px-3 py-2 text-sm" name="reason" placeholder="Reject reason" required /><button className="mt-1 w-full rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={stopped || rejectPending}>Reject</button><Result state={rejectState} /></form></div>;
}

export function ExecuteDocumentForm({ documentId, stopped }: { documentId: string; stopped: boolean }) {
  const [state, action, pending] = useActionState(executeDocumentAction.bind(null, documentId), initial);
  return <form action={action} className="mt-2 flex flex-wrap gap-2"><input className="min-w-48 flex-1 rounded-lg border px-3 py-2 text-sm" name="contentHash" placeholder="SHA-256 hash" required /><button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={stopped || pending}>{pending ? "Saving…" : "Mark executed"}</button><Result state={state} /></form>;
}

export function AdvanceTransactionForm({ transactionId, stopped }: { transactionId: string; stopped: boolean }) {
  const [state, action, pending] = useActionState(advanceTransactionAction.bind(null, transactionId), initial);
  return <form action={action} className="grid gap-3 md:grid-cols-2"><select className="rounded-xl border px-3 py-2.5 text-sm" name="nextStatus" required>{["RESEARCH","DUE_DILIGENCE","OFFER_PENDING","UNDER_CONTRACT","BUYER_MATCHING","ASSIGNMENT_PENDING","CLOSING_PENDING"].map((status) => <option key={status}>{status}</option>)}</select><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" disabled={stopped || pending}>{pending ? "Advancing…" : "Advance transaction"}</button><Result state={state} /></form>;
}

export function ProfessionalDiligenceForm({ transactionId, stopped }: { transactionId: string; stopped: boolean }) {
  const [state, action, pending] = useActionState(registerProfessionalDiligenceAction.bind(null, transactionId), initial);
  return <form action={action} className="grid gap-3 md:grid-cols-2"><select className="rounded-xl border px-3 py-2.5 text-sm" name="category" required>{["TITLE","SURVEY","ZONING","UTILITIES","ACCESS","ENVIRONMENTAL","LEGAL_DOCUMENTS","CLOSING_CONDITIONS"].map((item) => <option key={item}>{item}</option>)}</select><input className="rounded-xl border px-3 py-2.5 text-sm" name="artifactHash" placeholder="SHA-256 artifact hash" required /><input className="rounded-xl border px-3 py-2.5 text-sm" name="sourceUrl" placeholder="Secure artifact URL" type="url" required /><input className="rounded-xl border px-3 py-2.5 text-sm" name="professionalName" placeholder="Professional name" required /><input className="rounded-xl border px-3 py-2.5 text-sm" name="professionalRole" placeholder="Professional role" required /><input className="rounded-xl border px-3 py-2.5 text-sm" name="verifiedAt" type="datetime-local" required /><input className="rounded-xl border px-3 py-2.5 text-sm" name="expiresAt" type="datetime-local" /><input className="rounded-xl border px-3 py-2.5 text-sm" name="notes" placeholder="Scope or limitations" /><button className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 md:col-span-2" disabled={stopped || pending}>{pending ? "Registering…" : "Register professional evidence"}</button><Result state={state} /></form>;
}
