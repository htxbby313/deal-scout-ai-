import Link from "next/link";
import {
  createSellerEngagementAction,
  recordSellerConversationAction,
  startSellerThreadOnDealAction,
} from "@/app/seller-crm-actions";
import {
  DEAL_BOX_NO_CONVERSATION,
  DEAL_BOX_RECORD_EVIDENCE_COPY,
  DEAL_BOX_START_PURPOSE,
  sellerConversationHref,
  sellerFactsHref,
} from "@/lib/deal-cockpit";
import { engagementChannels, humanize } from "@/lib/seller-crm-domain";

const field =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

type ConversationNote = {
  id: string;
  occurredAt: Date;
  sourceType: string;
  summary: string;
};

type DealBoxSellerPanelProps = {
  propertyId: string;
  address: string;
  sellerName: string;
  phone: string | null;
  recipientDefault: string;
  recipientLabel: string;
  transactionId: string | null;
  engagementId: string | null;
  nextSellerAction: string | null;
  conversations: ConversationNote[];
};

export function DealBoxSellerPanel({
  propertyId,
  address,
  sellerName,
  phone,
  recipientDefault,
  recipientLabel,
  transactionId,
  engagementId,
  nextSellerAction,
  conversations,
}: DealBoxSellerPanelProps) {
  const inboxHref = sellerConversationHref({ engagementId, address });
  return (
    <article className="mt-4 rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">Seller</p>
      <p className="mt-1 font-bold">{sellerName}</p>
      <p className="mt-1 text-sm text-slate-600">
        {phone ? `Phone ${phone}` : "No phone on file"}
      </p>
      {nextSellerAction ? (
        <p className="mt-3 text-sm font-bold text-slate-900">
          Next seller action: {nextSellerAction}
        </p>
      ) : null}
      <ol className="mt-3 space-y-2">
        {conversations.length ? (
          conversations.map((note) => (
            <li
              className="rounded-lg border border-slate-100 bg-slate-50 p-3"
              key={note.id}
            >
              <p className="text-xs font-semibold text-slate-500">
                {note.occurredAt.toLocaleString()} · {note.sourceType}
              </p>
              <p className="mt-1 text-sm text-slate-800">{note.summary}</p>
            </li>
          ))
        ) : (
          <li className="text-sm text-slate-600">{DEAL_BOX_NO_CONVERSATION}</li>
        )}
      </ol>
      {engagementId ? (
        <form action={recordSellerConversationAction} className="mt-4 grid gap-3">
          <input name="engagementId" type="hidden" value={engagementId} />
          <input name="propertyId" type="hidden" value={propertyId} />
          <label className="grid gap-1 text-sm font-semibold">
            When
            <input
              className={field}
              defaultValue={new Date().toISOString().slice(0, 16)}
              name="occurredAt"
              required
              type="datetime-local"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Source type
            <input
              className={field}
              name="sourceType"
              placeholder="Call, reply, meeting…"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Summary
            <textarea
              className={`${field} min-h-20 resize-y`}
              name="summary"
              placeholder="What the seller said. This saves evidence; it does not send."
              required
            />
          </label>
          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              Objections and questions
            </summary>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1 text-sm font-semibold">
                Seller objections
                <textarea
                  className={`${field} min-h-16`}
                  name="objections"
                  placeholder="One objection per line"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Seller questions
                <textarea
                  className={`${field} min-h-16`}
                  name="questions"
                  placeholder="One question per line"
                />
              </label>
            </div>
          </details>
          <p className="text-xs text-slate-500">{DEAL_BOX_RECORD_EVIDENCE_COPY}</p>
          <button className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">
            Record conversation
          </button>
        </form>
      ) : transactionId ? (
        <StartSellerThreadForm
          action={createSellerEngagementAction}
          propertyId={propertyId}
          recipientDefault={recipientDefault}
          recipientLabel={recipientLabel}
          transactionId={transactionId}
        />
      ) : (
        <StartSellerThreadForm
          action={startSellerThreadOnDealAction}
          propertyId={propertyId}
          recipientDefault={recipientDefault}
          recipientLabel={recipientLabel}
        />
      )}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {engagementId ? (
          <Link className="font-semibold text-blue-700" href={sellerFactsHref(engagementId)}>
            Full seller facts
          </Link>
        ) : null}
        <Link className="font-semibold text-slate-600" href={inboxHref}>
          Open full conversation inbox
        </Link>
      </div>
    </article>
  );
}

function StartSellerThreadForm({
  action,
  propertyId,
  recipientDefault,
  recipientLabel,
  transactionId,
}: {
  action: (data: FormData) => Promise<void>;
  propertyId: string;
  recipientDefault: string;
  recipientLabel: string;
  transactionId?: string;
}) {
  return (
    <form action={action} className="mt-4 grid gap-3">
      <input name="propertyId" type="hidden" value={propertyId} />
      {transactionId ? (
        <input name="transactionId" type="hidden" value={transactionId} />
      ) : null}
      <input name="recipientLabel" type="hidden" value={recipientLabel} />
      <p className="text-sm font-bold">Start seller thread</p>
      <label className="grid gap-1 text-sm font-semibold">
        Channel
        <select className={field} name="channel" required>
          {engagementChannels.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Recipient
        <input
          className={field}
          defaultValue={recipientDefault}
          name="recipient"
          required
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Purpose
        <input
          className={field}
          defaultValue={DEAL_BOX_START_PURPOSE}
          name="purpose"
          required
        />
      </label>
      <p className="text-xs text-slate-500">
        Creates an internal seller thread on this deal. {DEAL_BOX_RECORD_EVIDENCE_COPY}
      </p>
      <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
        Start seller thread
      </button>
    </form>
  );
}
