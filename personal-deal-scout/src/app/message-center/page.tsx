import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import {
  CONVERSATION_PATHWAYS,
  defaultPathwayTemplates,
  isConversationPathwayId,
  type ConversationPathwayId,
} from "@/lib/conversation-pathways";
import { CopyMessageButton } from "./copy-button";
import {
  regenerateMessageAction,
  saveMessageAction,
  savePathwayTemplateAction,
  sendMessageAction,
} from "./actions";

export const dynamic = "force-dynamic";

const channels = ["SMS", "EMAIL", "VOICE", "INTERNAL"] as const;

function pathwayFromParam(value?: string): ConversationPathwayId {
  return value && isConversationPathwayId(value) ? value : "SELLER_ACQUISITION";
}

function isDeveloperDraft(subject?: string | null) {
  return subject?.startsWith("Acquisitions relationship:") ?? false;
}

function isPricingRequest(subject?: string | null) {
  return subject?.startsWith("Pricing request:") ?? false;
}

function draftContext(draft: {
  subject: string | null;
  lead?: { property?: { address: string; city: string; state: string; zipCode: string } | null } | null;
}) {
  if (isDeveloperDraft(draft.subject)) {
    return {
      label: "Company",
      value: draft.subject!.replace("Acquisitions relationship:", "").trim() || "Company relationship",
    };
  }

  if (draft.lead?.property) {
    return {
      label: "Property",
      value: draft.lead.property.address,
      detail: `${draft.lead.property.city}, ${draft.lead.property.state} ${draft.lead.property.zipCode}`,
    };
  }

  if (isPricingRequest(draft.subject)) {
    return {
      label: "Property",
      value: draft.subject!.replace("Pricing request:", "").trim() || "Property",
    };
  }

  return { label: "Relationship", value: "Property not linked" };
}

export default async function MessageCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ pathway?: string }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const pathway = pathwayFromParam(params.pathway);
  const db = getPrisma();
  const [templates, drafts] = await Promise.all([
    db.messageTemplate.findMany({
      where: { type: { in: CONVERSATION_PATHWAYS.map((item) => item.id) } },
      orderBy: [{ type: "asc" }, { channel: "asc" }],
    }),
    db.messageApproval.findMany({
      where: { status: { in: ["PENDING", "APPROVED", "SENT_BLOCKED"] } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { lead: { include: { property: true } } },
    }),
  ]);

  const pathwayDrafts = drafts.filter((draft) => {
    if (isPricingRequest(draft.subject)) return false;
    return pathway === "DEVELOPER_BUYER_ACQUISITION"
      ? isDeveloperDraft(draft.subject)
      : !isDeveloperDraft(draft.subject);
  });
  const pathwayMeta = CONVERSATION_PATHWAYS.find((item) => item.id === pathway)!;
  const isDeveloperPathway = pathway === "DEVELOPER_BUYER_ACQUISITION";

  const pathwayContext = pathwayDrafts.length ? draftContext(pathwayDrafts[0]) : null;

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="border-b bg-white px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Deal Scout</p>
            <h1 className="mt-1 text-3xl font-bold">Message Center</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Relationship messaging only. Seller Acquisition is for the owner or authorized contact on a specific property. Developer Acquisition is for company relationships and buy-box discovery. Property research itself stays in the property workspace.
            </p>
          </div>
          <Link className="rounded-lg border px-3 py-2 text-sm font-semibold" href="/seller-crm">
            Back to Contacts
          </Link>
        </div>
      </header>

      <nav className="border-b bg-white px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
          {CONVERSATION_PATHWAYS.map((item) => (
            <Link
              key={item.id}
              href={`/message-center?pathway=${item.id}`}
              className={`rounded-full border px-4 py-2 text-sm font-bold ${pathway === item.id ? "border-blue-600 bg-blue-50 text-blue-800" : "bg-white text-slate-600"}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="space-y-4">
          <div className="rounded-2xl border bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  {pathwayMeta.label}
                </div>
                <h2 className="mt-2 text-xl font-bold">
                  {pathwayContext?.value ?? (isDeveloperPathway ? "Developer company" : "Property")}
                </h2>
                {pathwayContext?.detail ? (
                  <p className="mt-1 text-sm text-slate-500">{pathwayContext.detail}</p>
                ) : null}
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {isDeveloperPathway ? "Company relationship" : "Property relationship"}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-500">{pathwayMeta.description}</p>
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {isDeveloperPathway
                ? "Start with the company and its acquisitions contact. The goal is to learn and maintain the developer's buy box before presenting a property."
                : "Start with the property and its owner or authorized contact. The goal is to discuss the property's plans and pursue an acquisition conversation."}
            </p>
          </div>

          {pathwayDrafts.map((draft) => {
            const context = draftContext(draft);
            return (
              <article key={draft.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      {context.label}
                    </p>
                    <h2 className="mt-1 truncate font-bold">{context.value}</h2>
                    {context.detail ? (
                      <p className="mt-1 text-xs text-slate-500">{context.detail}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      {draft.recipientLabel} · {draft.channel} · {draft.status}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{draft.provider}</span>
                    <span className="text-xs font-semibold text-slate-400">
                      {isDeveloperPathway ? "Developer buyer" : "Seller acquisition"}
                    </span>
                  </div>
                </div>

                <form action={saveMessageAction} className="mt-4 space-y-3">
                  <input name="approvalId" type="hidden" value={draft.id} />
                  <textarea
                    name="body"
                    defaultValue={draft.body}
                    rows={8}
                    aria-label={`Edit message to ${draft.recipientLabel}`}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Save Edit</button>
                    <button formAction={regenerateMessageAction} className="rounded-lg border px-4 py-2 text-sm font-bold">Regenerate</button>
                    <button formAction={sendMessageAction} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Send</button>
                    <CopyMessageButton text={draft.body} />
                  </div>
                </form>

                {draft.blockerCodes.length ? (
                  <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                    Send result: {draft.blockerCodes.join(" · ")}
                  </p>
                ) : null}
              </article>
            );
          })}

          {!pathwayDrafts.length ? (
            <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
              No drafts in this pathway yet. You can still edit the pathway template on the right.
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold">Independent pathway template</h2>
            <p className="mt-1 text-xs text-slate-500">
              Changes here affect only this relationship pathway and channel.
            </p>
            {channels.map((channel) => {
              const template = templates.find(
                (item) => item.type === pathway && item.channel === channel,
              );
              return (
                <form key={channel} action={savePathwayTemplateAction} className="mt-4 border-t pt-4">
                  <input name="pathway" type="hidden" value={pathway} />
                  <input name="channel" type="hidden" value={channel} />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{channel}</label>
                  <textarea
                    name="body"
                    defaultValue={template?.body ?? defaultPathwayTemplates[pathway]}
                    rows={5}
                    className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <button className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold">
                    Save {channel} Template
                  </button>
                </form>
              );
            })}
          </div>
        </aside>
      </div>
    </main>
  );
}
