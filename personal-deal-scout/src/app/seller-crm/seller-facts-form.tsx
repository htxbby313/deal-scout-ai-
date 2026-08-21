"use client";

import { useActionState } from "react";
import {
  recordSellerFactsFormAction,
  type SellerFactsFormState,
} from "@/app/seller-crm-actions";

const field =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const initialState: SellerFactsFormState = { status: "idle", message: "" };
const words = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());

export function SellerFactsForm(props: {
  engagementId: string;
  conversationId: string;
  authorityStatuses: string[];
  representationStatuses: string[];
  channels: string[];
  current: {
    priorities: string[];
    timeline?: string | null;
    propertyCondition?: string | null;
    authorityStatus?: string;
    authoritySourceUrl?: string | null;
    representationStatus?: string;
    preferredChannel?: string | null;
  } | null;
}) {
  const [state, action, pending] = useActionState(
    recordSellerFactsFormAction,
    initialState,
  );
  return (
    <form action={action} className="space-y-2 border-t p-4">
      <input name="engagementId" type="hidden" value={props.engagementId} />
      <input name="conversationId" type="hidden" value={props.conversationId} />
      {state.message ? (
        <p
          aria-live="polite"
          className={`rounded-lg px-3 py-2 text-xs ${state.status === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {state.message}
        </p>
      ) : null}
      <textarea
        className={field}
        defaultValue={props.current?.priorities.join(", ")}
        name="priorities"
        placeholder="Seller priorities, comma separated"
      />
      <input
        className={field}
        defaultValue={props.current?.timeline ?? ""}
        name="timeline"
        placeholder="Seller timeline"
      />
      <input
        className={field}
        defaultValue={props.current?.propertyCondition ?? ""}
        name="propertyCondition"
        placeholder="Seller-stated property condition"
      />
      <input
        className={field}
        name="desiredProceeds"
        placeholder="Desired proceeds"
      />
      <input
        className={field}
        name="minimumNetProceeds"
        placeholder="Minimum net proceeds"
      />
      <select
        className={field}
        defaultValue={props.current?.authorityStatus ?? "UNKNOWN"}
        name="authorityStatus"
      >
        {props.authorityStatuses.map((value) => (
          <option key={value} value={value}>
            {words(value)}
          </option>
        ))}
      </select>
      <input
        className={field}
        defaultValue={props.current?.authoritySourceUrl ?? ""}
        name="authoritySourceUrl"
        placeholder="Authority evidence URL"
        type="url"
      />
      <select
        className={field}
        defaultValue={props.current?.representationStatus ?? "UNKNOWN"}
        name="representationStatus"
      >
        {props.representationStatuses.map((value) => (
          <option key={value} value={value}>
            {words(value)}
          </option>
        ))}
      </select>
      <select
        className={field}
        defaultValue={props.current?.preferredChannel ?? ""}
        name="preferredChannel"
      >
        <option value="">No preference recorded</option>
        {props.channels.map((value) => (
          <option key={value} value={value}>
            {words(value)}
          </option>
        ))}
      </select>
      <label className="block text-xs font-semibold text-slate-600">
        Seller stated at
        <input
          className={`${field} mt-1`}
          defaultValue={new Date().toISOString().slice(0, 16)}
          name="sellerStatedAt"
          type="datetime-local"
          required
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Independent advice offered at
        <input
          className={`${field} mt-1`}
          name="independentAdviceOfferedAt"
          type="datetime-local"
        />
      </label>
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input name="independentAdviceRequired" type="checkbox" />
        Independent advice is required for this intake.
      </label>
      <textarea
        className={field}
        name="correctionReason"
        placeholder="Correction reason when replacing prior facts"
      />
      <button
        className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Saving…" : "Save seller facts"}
      </button>
    </form>
  );
}
