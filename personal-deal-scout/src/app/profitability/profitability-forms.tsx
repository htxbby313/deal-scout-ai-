"use client";

import { useActionState } from "react";
import { createProjectionAction, createSettlementReviewAction, type ProfitabilityActionState } from "@/app/profitability-actions";

const initial: ProfitabilityActionState = { status: "idle", message: "" };
const input = "rounded-lg border px-3 py-2 text-sm";
const Field = ({ name, placeholder, required = false, type = "text" }: { name: string; placeholder: string; required?: boolean; type?: string }) => <input className={input} name={name} placeholder={placeholder} required={required} step={type === "number" ? "0.01" : undefined} type={type} />;
const Result = ({ state }: { state: ProfitabilityActionState }) => state.message ? <p className={`text-sm font-semibold md:col-span-4 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null;

export function FinancialProjectionForm({ transactions }: { transactions: Array<{ id: string; label: string }> }) {
  const [state, action, pending] = useActionState(createProjectionAction, initial);
  return <form action={action} className="mt-4 grid gap-3 md:grid-cols-4">
    <select className={input} name="transactionId" required><option value="">Transaction</option>{transactions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
    <Field name="sellerAskingPrice" placeholder="Seller asking price" type="number" /><Field name="sellerMinimumNet" placeholder="Seller minimum net" type="number" /><Field name="sellerContractPrice" placeholder="Seller contract price" required type="number" />
    <Field name="buyerPriceLow" placeholder="Buyer price low" required type="number" /><Field name="buyerPriceBase" placeholder="Buyer price base" required type="number" /><Field name="buyerPriceHigh" placeholder="Buyer price high" required type="number" />
    <select className={input} defaultValue="DOCUMENTED" name="buyerPriceStatus"><option value="DOCUMENTED">Documented buyer price</option><option value="COMMITTED">Committed buyer price</option></select>
    <Field name="buyerPriceSourceUrl" placeholder="Buyer pricing evidence URL" required type="url" /><Field name="buyerPriceObservedAt" placeholder="Observed" required type="date" /><Field name="buyerPriceExpiresAt" placeholder="Expires" required type="date" />
    {["transactionCosts","doubleClosingCosts","titleExpenses","closingExpenses","transactionalFunding","financingCosts","taxes","liensAndPayoffs","concessions","inspectionExpenses","legalExpenses","dataMarketingCosts","insuranceExpenses","otherExpenses","riskReserve","contingencyReserve","earnestMoneyDeposited","earnestMoneyAtRisk"].map((name) => <Field key={name} name={name} placeholder={name.replace(/([A-Z])/g, " $1").toLowerCase()} type="number" />)}
    <Field name="minimumRequiredProfit" placeholder="Minimum required profit" required type="number" /><Field name="targetProfitHigh" placeholder="High target profit" required type="number" />
    <Field name="probabilityLowBps" placeholder="Low probability bps" required type="number" /><Field name="probabilityBaseBps" placeholder="Base probability bps" required type="number" /><Field name="probabilityHighBps" placeholder="High probability bps" required type="number" />
    <textarea className={`${input} md:col-span-4`} name="costEvidence" placeholder='Required evidence for each nonzero cost: [{"category":"titleExpenses","amount":"500.00","evidenceStatus":"TITLE_FIGURE","sourceUrl":"https://...","observedAt":"2026-08-19","expiresAt":"2026-09-19"}]' required />
    <textarea className={`${input} md:col-span-3`} name="evidenceNotes" placeholder="Supplemental pricing assumptions and unresolved items" required /><Field name="correctionReason" placeholder="Correction reason for later versions" />
    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-4" disabled={pending}>{pending ? "Calculating…" : "Record verified financial scenario"}</button><Result state={state} />
  </form>;
}

export function SettlementReviewForm({ transactions }: { transactions: Array<{ id: string; label: string }> }) {
  const [state, action, pending] = useActionState(createSettlementReviewAction, initial);
  return <form action={action} className="mt-4 grid gap-3 md:grid-cols-3"><select className={input} name="transactionId" required><option value="">Transaction</option>{transactions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><Field name="grossAssignmentFee" placeholder="Actual gross proceeds" required type="number" /><Field name="actualExpenses" placeholder="Actual itemized expenses total" required type="number" /><textarea className={`${input} md:col-span-3`} name="expenseLines" placeholder='Expense lines JSON: [{"category":"TITLE","amount":"500.00","sourceReference":"settlement-line-12"}]' required/><Field name="settlementDocumentUrl" placeholder="Settlement document HTTPS URL" required type="url" /><Field name="settlementDocumentHash" placeholder="Settlement document SHA-256" required /><Field name="reviewedAt" placeholder="Reviewed at" required type="datetime-local" /><Field name="correctionReason" placeholder="Correction reason for later versions" /><button className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2" disabled={pending}>{pending ? "Recording…" : "Record reviewed closed profit"}</button><Result state={state} /></form>;
}
