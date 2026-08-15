"use client";

import { useActionState } from "react";
import type { CsvImportState } from "@/app/actions";

const initialState: CsvImportState = { status: "idle", message: "" };

export function CsvImportForm({
  action,
  buttonLabel,
  helpText,
}: {
  action: (state: CsvImportState, formData: FormData) => Promise<CsvImportState>;
  buttonLabel: string;
  helpText: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">Bulk CSV import</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{helpText}</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" name="csvFile" type="file" accept=".csv,text/csv" required />
        <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={pending}>
          {pending ? "Importing…" : buttonLabel}
        </button>
      </div>
      {state.message ? <p aria-live="polite" className={`mt-3 text-sm font-medium ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}>{state.message}</p> : null}
    </form>
  );
}
