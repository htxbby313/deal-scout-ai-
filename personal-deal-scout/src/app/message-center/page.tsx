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
    }),
  ]);

  const pathwayDrafts = drafts.filter((draft) => {
    if (pathway === "SELLER_ACQUISITION")
      return !draft.subject?.startsWith("Acquisitions relationship:") &&
        !draft.subject?.startsWith("Pricing request:");
    return pathway === "DEVELOPER_BUYER_ACQUISITION"
      ? draft.subject?.startsWith("Acquisitions relationship:") || draft.subject?.startsWith("Pricing request:")
      : true;
  });

  return (
    <main className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="border-b bg-white px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Deal Scout</p>
            <h1 className="mt-1 text-3xl font-bold">Message Center</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Work each pathway independently. Every draft has its own Edit, Regenerate, Copy, and Send controls.
            </p>
          </div>
          <Link className="rounded-lg border px-3 py-2 text-sm font-semibold" href="/seller-crm">Back to Contacts</Link>
        </div>
      </header>

      <nav className="border-b bg-white px-5 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
          {CONVERSATION_PATHWAYS.map((item) => (
            <Link
              key={item.id}
              href={`/message-center?pathway=${item.id}`}
              className={`rounded-full border px-4 py-2 text-sm font-bold ${pathway === item.id ? "border-blue-600 bg-blue-50 text-blue-800" : "bg-white text-slate-600"}`}
            >{item.label}</Link>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="space-y-4">
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-bold">{CONVERSATION_PATHWAYS.find((item) => item.id === pathway)?.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{CONVERSATION_PATHWAYS.find((item) => item.id === pathway)?.description}</p>
          </div>

          {pathwayDrafts.map((draft) => (
            <article key={draft.id} className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold">{draft.subject || "Message draft"}</h2>
                  <p className="text-xs text-slate-500">{draft.recipientLabel} · {draft.channel} · {draft.status}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{draft.provider}</span>
              </div>

              <form action={saveMessageAction} className="mt-4 space-y-3">
                <input name="approvalId" type="hidden" value={draft.id} />
                <textarea name="body" defaultValue={draft.body} rows={8} aria-label={`Edit message to ${draft.recipientLabel}`} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Save Edit</button>
                  <button formAction={regenerateMessageAction} className="rounded-lg border px-4 py-2 text-sm font-bold">Regenerate</button>
                  <button formAction={sendMessageAction} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Send</button>
                  <CopyMessageButton text={draft.body} />
                </div>
              </form>

              {draft.blockerCodes.length ? (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Send result: {draft.blockerCodes.join(" · ")}</p>
              ) : null}
            </article>
          ))}

          {!pathwayDrafts.length ? (
            <div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">No drafts in this pathway yet. You can still edit the pathway template on the right.</div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold">Independent pathway template</h2>
            <p className="mt-1 text-xs text-slate-500">Changes here affect only this pathway and channel.</p>
            {channels.map((channel) => {
              const template = templates.find((item) => item.type === pathway && item.channel === channel);
              return (
                <form key={channel} action={savePathwayTemplateAction} className="mt-4 border-t pt-4">
                  <input name="pathway" type="hidden" value={pathway} />
                  <input name="channel" type="hidden" value={channel} />
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{channel}</label>
                  <textarea name="body" defaultValue={template?.body ?? defaultPathwayTemplates[pathway]} rows={5} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  <button className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold">Save {channel} Template</button>
                </form>
              );
            })}
          </div>
        </aside>
      </div>
    </main>
  );
}
