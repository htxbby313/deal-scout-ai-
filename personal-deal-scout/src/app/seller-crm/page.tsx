import Link from "next/link";
import {
  createSellerEngagementAction,
  recordSellerConversationAction,
  recordSellerDispositionAction,
  scheduleSellerFollowUpAction,
  reviewSellerEngagementAction,
} from "@/app/seller-crm-actions";
import { approveMessageAction, rejectMessageAction } from "@/app/actions";
import { SellerFactsForm } from "@/app/seller-crm/seller-facts-form";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { readSellerCrm, readSellerTimeline } from "@/lib/seller-crm";
import {
  engagementChannels,
  humanize,
  isEngagementVisibleInView,
  sellerAuthorityStatuses,
  selectVisibleEngagement,
  sellerDispositionReasons,
  sellerRepresentationStatuses,
  sellerNextAction,
} from "@/lib/seller-crm-domain";

export const dynamic = "force-dynamic";
const field =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const channels = engagementChannels;
const words = humanize;
const money = (value?: bigint | number | null) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(Number(value) / 100);

export default async function SellerCrmPage({
  searchParams,
}: {
  searchParams: Promise<{
    engagementId?: string;
    view?: string;
    q?: string;
    timelinePage?: string;
  }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const [engagements, transactions, developerDrafts] = await Promise.all([
    readSellerCrm(),
    getPrisma().dealTransaction.findMany({
      include: { property: true },
      orderBy: { updatedAt: "desc" },
    }),
    getPrisma().messageApproval.findMany({
      where: {
        status: { in: ["PENDING", "APPROVED", "SENT_BLOCKED"] },
        OR: [
          { subject: { startsWith: "Acquisitions relationship:" } },
          {
            subject: { startsWith: "Pricing request:" },
            leadId: { not: null },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 24,
    }),
  ]);
  const term = params.q?.trim().toLowerCase();
  const conversationStages = [
    [
      "Open",
      engagements.filter((item) =>
        isEngagementVisibleInView(item.status, "open"),
      ).length,
    ],
    [
      "Follow-up",
      engagements.filter((item) =>
        item.followUps.some((row) => ["SCHEDULED", "DUE"].includes(row.status)),
      ).length,
    ],
    [
      "Offer",
      engagements.filter((item) => item.offerHistory.length > 0).length,
    ],
    [
      "Contract",
      engagements.filter((item) =>
        [
          "UNDER_CONTRACT",
          "BUYER_MATCHING",
          "ASSIGNMENT_PENDING",
          "CLOSING_PENDING",
        ].includes(item.transaction.status),
      ).length,
    ],
    [
      "Complete",
      engagements.filter((item) => item.transaction.status === "COMPLETED")
        .length,
    ],
  ] as const;
  const currentView = params.view || "open";
  const visible = engagements.filter((item) => {
    if (
      term &&
      !`${item.recipientLabel ?? ""} ${item.transaction.property.ownerName} ${item.transaction.property.address} ${item.transaction.property.city}`
        .toLowerCase()
        .includes(term)
    )
      return false;
    if (!isEngagementVisibleInView(item.status, currentView)) return false;
    if (
      params.view === "follow-up" &&
      !item.followUps.some((row) => ["SCHEDULED", "DUE"].includes(row.status))
    )
      return false;
    if (params.view === "offers" && !item.offerHistory.length) return false;
    if (
      params.view === "contract" &&
      ![
        "UNDER_CONTRACT",
        "BUYER_MATCHING",
        "ASSIGNMENT_PENDING",
        "CLOSING_PENDING",
        "COMPLETED",
      ].includes(item.transaction.status)
    )
      return false;
    return true;
  });
  const selected = params.engagementId
    ? selectVisibleEngagement(engagements, params.engagementId)
    : selectVisibleEngagement(visible);
  const action = selected
    ? sellerNextAction({
        controlStatus: selected.transaction.controlStatus,
        consentStatus: selected.consents[0]?.status,
        conversationCount: selected.conversations.length,
        sellerFactCount: selected.sellerFacts.length,
        engagementStatus: selected.status,
        followUps: selected.followUps,
        latestOfferStatus: selected.offerHistory[0]?.status,
      })
    : null;
  const timelinePage = Math.max(
    0,
    Number.parseInt(params.timelinePage || "0", 10) || 0,
  );
  const timeline = selected
    ? await readSellerTimeline(selected.id, timelinePage)
    : { events: [], hasEarlier: false };

  return (
    <WorkspaceShell active="seller-crm">
      <div className="min-h-dvh bg-slate-50">
        <header className="border-b bg-white px-4 py-4 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Owner-controlled seller workspace
          </p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Contacts</h1>
              <p className="mt-1 text-sm text-slate-500">
                Build seller and buyer relationships, follow the next step, and
                keep every conversation attached to its deal.
              </p>
            </div>
            <details className="rounded-xl border bg-white">
              <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">
                Start a conversation record
              </summary>
              <form
                action={createSellerEngagementAction}
                className="grid w-[min(90vw,32rem)] gap-3 border-t p-4"
              >
                <select className={field} name="transactionId" required>
                  <option value="">Choose a transaction</option>
                  {transactions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.property.address}
                    </option>
                  ))}
                </select>
                <select className={field} name="channel">
                  {channels.map((value) => (
                    <option key={value} value={value}>
                      {words(value)}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  name="recipient"
                  placeholder="Recipient address or number (stored hashed)"
                  required
                />
                <input
                  className={field}
                  name="recipientLabel"
                  placeholder="Seller or contact name"
                />
                <textarea
                  className={field}
                  name="purpose"
                  placeholder="Why contact may be appropriate"
                  required
                />
                <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
                  Save conversation draft
                </button>
              </form>
            </details>
          </div>
        </header>
        <nav
          aria-label="Contact type"
          className="flex gap-2 border-b bg-white px-4 py-3 sm:px-6"
        >
          <Link
            aria-current="page"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white"
            href="/seller-crm"
          >
            Sellers
          </Link>
          <Link
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-400 hover:text-blue-800"
            href="/developers"
          >
            Buyers & developers
          </Link>
        </nav>
        <nav
          aria-label="Conversation pipeline"
          className="grid grid-cols-2 gap-2 border-b bg-white px-4 pb-4 sm:grid-cols-5 sm:px-6"
        >
          {conversationStages.map(([label, count], index) => (
            <div className="relative rounded-xl border p-3" key={label}>
              <span className="text-xs text-slate-500">
                {index + 1}. {label}
              </span>
              <b className="mt-1 block text-xl">{count}</b>
              {index < conversationStages.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-slate-300 sm:block"
                >
                  →
                </span>
              ) : null}
            </div>
          ))}
        </nav>
        <details
          className="border-b bg-white px-4 py-4 sm:px-6"
          id="developer-drafts"
          open={developerDrafts.some((draft) => draft.status === "PENDING")}
        >
          <summary className="cursor-pointer font-bold">
            Buyer and developer drafts ·{" "}
            {
              developerDrafts.filter((draft) => draft.status === "PENDING")
                .length
            }{" "}
            awaiting review
          </summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {developerDrafts.map((draft) => (
              <article className="rounded-xl border p-4" key={draft.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold">{draft.subject}</h2>
                    <p className="text-xs text-slate-500">
                      {draft.recipientLabel} · {words(draft.status)}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold">
                    {draft.channel}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                  {draft.body}
                </p>
                {draft.status === "PENDING" ? (
                  <div className="mt-4 flex gap-2">
                    <form action={approveMessageAction}>
                      <input name="approvalId" type="hidden" value={draft.id} />
                      <button className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">
                        Approve draft
                      </button>
                    </form>
                    <form action={rejectMessageAction}>
                      <input name="approvalId" type="hidden" value={draft.id} />
                      <button className="rounded-lg border px-3 py-2 text-xs font-bold">
                        Reject
                      </button>
                    </form>
                  </div>
                ) : null}
                {draft.blockerCodes.length ? (
                  <p className="mt-3 text-xs text-amber-800">
                    Send blockers: {draft.blockerCodes.map(words).join(" · ")}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          {!developerDrafts.length ? (
            <p className="mt-3 text-sm text-slate-500">
              No relationship drafts are ready. Deal Scout creates a general
              buy-box introduction first; specific properties stay blocked until
              the required contract and disposition gates are satisfied.
            </p>
          ) : null}
        </details>
        <div className="grid min-h-[calc(100dvh-7rem)] xl:grid-cols-[17rem_minmax(30rem,1fr)_20rem]">
          <aside className="border-r bg-white p-4">
            <form>
              <input
                className={field}
                defaultValue={params.q}
                name="q"
                placeholder="Search conversations…"
              />
              <input name="view" type="hidden" value={currentView} />
            </form>
            <nav
              aria-label="Conversation filters"
              className="mt-3 flex flex-wrap gap-2"
            >
              {[
                ["open", "Open"],
                ["follow-up", "Follow-up"],
                ["offers", "Offers"],
                ["contract", "Contract"],
                ["completed", "Completed"],
                ["cancelled", "Cancelled"],
                ["all", "All history"],
              ].map(([value, label]) => (
                <Link
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${currentView === value ? "border-blue-300 bg-blue-50 text-blue-800" : "text-slate-600"}`}
                  href={`/seller-crm?view=${value}`}
                  key={value}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 space-y-2">
              {visible.map((item) => (
                <Link
                  className={`block rounded-xl border p-3 ${selected?.id === item.id ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-100" : "bg-white hover:bg-slate-50"}`}
                  href={`/seller-crm?engagementId=${item.id}&view=${currentView}`}
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-sm">
                      {item.recipientLabel ||
                        item.transaction.property.ownerName ||
                        "Seller"}
                    </strong>
                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                      {item.sellerFacts[0]?.authorityStatus === "VERIFIED"
                        ? "Verified"
                        : words(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-700">
                    {item.transaction.property.address}
                  </p>
                  <p className="text-xs text-slate-400">
                    {item.transaction.property.city},{" "}
                    {item.transaction.property.state}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                    {words(item.transaction.status)}
                  </span>
                </Link>
              ))}
              {!visible.length ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-sm text-slate-500">
                  No conversations match this view. No seller is selected and no
                  seller action can be submitted.
                </p>
              ) : null}
            </div>
          </aside>
          <main className="flex min-w-0 flex-col">
            {selected && action ? (
              <>
                <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-white px-5 py-4">
                  <div>
                    <h2 className="text-xl font-bold">
                      {selected.recipientLabel ||
                        selected.transaction.property.ownerName ||
                        "Seller"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {selected.transaction.property.address},{" "}
                      {selected.transaction.property.city},{" "}
                      {selected.transaction.property.state}{" "}
                      {selected.transaction.property.zipCode}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-lg border px-3 py-2 text-xs font-semibold">
                      {words(selected.channel)}
                    </span>
                    <span className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">
                      {words(selected.transaction.status)}
                    </span>
                  </div>
                </header>
                {selected.status === "READY_FOR_OWNER_REVIEW" ? (
                  <section className="m-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                      Seller draft awaiting review
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-800">
                      {selected.purpose}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <form action={reviewSellerEngagementAction}>
                        <input
                          name="engagementId"
                          type="hidden"
                          value={selected.id}
                        />
                        <input name="decision" type="hidden" value="approve" />
                        <button className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white">
                          Approve draft
                        </button>
                      </form>
                      <form action={reviewSellerEngagementAction}>
                        <input
                          name="engagementId"
                          type="hidden"
                          value={selected.id}
                        />
                        <input name="decision" type="hidden" value="reject" />
                        <button className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold">
                          Reject
                        </button>
                      </form>
                    </div>
                    <p className="mt-3 text-xs text-slate-600">
                      Approval reviews the wording only. It does not send the
                      message.
                    </p>
                  </section>
                ) : null}
                <section
                  className={`m-5 rounded-2xl border p-4 ${action[2] === "red" ? "border-red-200 bg-red-50" : action[2] === "amber" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}`}
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    Next best action
                  </p>
                  <h3 className="mt-1 font-bold">{action[0]}</h3>
                  <p className="mt-1 text-sm text-slate-600">{action[1]}</p>
                  {action[3] ? (
                    <a
                      className="mt-3 inline-block rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white"
                      href={action[3]}
                    >
                      Open this step
                    </a>
                  ) : null}
                </section>
                <section
                  aria-label="Conversation timeline"
                  className="flex-1 space-y-3 overflow-y-auto px-5 pb-5"
                >
                  {timeline.events.map((event) => (
                    <article
                      aria-label={event.accessibilityLabel}
                      className={`max-w-[82%] rounded-2xl border p-4 text-sm shadow-sm ${event.presentation === "outbound" ? "ml-auto border-blue-200 bg-blue-50" : event.presentation === "workflow" ? "max-w-full border-amber-200 bg-amber-50" : event.presentation === "system" ? "max-w-full bg-slate-100" : "bg-white"}`}
                      key={event.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        <span>
                          {event.type} · {event.accessibilityLabel}
                        </span>
                        <span>
                          {event.at.toLocaleString()} · {event.status}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-slate-700">
                        {event.body}
                      </p>
                    </article>
                  ))}
                  {!timeline.events.length ? (
                    <div className="rounded-2xl border border-dashed bg-white p-8 text-center">
                      <h3 className="font-bold">No conversation history yet</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Record a sourced interaction below. The app will not
                        invent a seller response.
                      </p>
                    </div>
                  ) : null}
                  {timeline.hasEarlier ? (
                    <Link
                      className="mx-auto block w-fit rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
                      href={`/seller-crm?engagementId=${selected.id}&view=${currentView}&timelinePage=${timelinePage + 1}`}
                    >
                      Load earlier activity
                    </Link>
                  ) : null}
                </section>
                <footer className="border-t bg-white p-4">
                  <form
                    action={recordSellerConversationAction}
                    className="space-y-3"
                  >
                    <input
                      name="engagementId"
                      type="hidden"
                      value={selected.id}
                    />
                    <div className="flex flex-wrap gap-2">
                      <input
                        className={`${field} max-w-44`}
                        defaultValue={new Date().toISOString().slice(0, 16)}
                        name="occurredAt"
                        type="datetime-local"
                        required
                      />
                      <input
                        className={`${field} max-w-44`}
                        name="sourceType"
                        placeholder="Call, reply, meeting…"
                        required
                      />
                      <input
                        className={`${field} min-w-56 flex-1`}
                        name="sourceUrl"
                        type="url"
                        placeholder="Source or recording URL (optional)"
                      />
                    </div>
                    <textarea
                      className={`${field} min-h-24 resize-y`}
                      name="summary"
                      placeholder="Record what happened. This saves evidence; it does not send a message."
                      required
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Seller objections
                        <textarea
                          className={`${field} mt-1 min-h-20`}
                          name="objections"
                          placeholder="One objection per line"
                        />
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Seller questions
                        <textarea
                          className={`${field} mt-1 min-h-20`}
                          name="questions"
                          placeholder="One question per line"
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Outbound follows the configured consent, DNC,
                        state-policy, transaction, provider, and owner gates.
                      </p>
                      <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
                        Add to timeline
                      </button>
                    </div>
                  </form>
                </footer>
              </>
            ) : (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div>
                  <h2 className="text-xl font-bold">No seller selected</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    No visible conversation matches this filter. Clear the
                    filter or choose another view.
                  </p>
                  <Link
                    className="mt-4 inline-block rounded-lg border bg-white px-4 py-2 text-sm font-semibold"
                    href="/seller-crm?view=open"
                  >
                    Clear filters
                  </Link>
                </div>
              </div>
            )}
          </main>
          <aside className="border-l bg-white p-4">
            {selected ? (
              <div className="space-y-3">
                <Panel
                  title="Deal snapshot"
                  rows={[
                    ["Control", words(selected.transaction.controlStatus)],
                    ["Stage", words(selected.transaction.status)],
                    ["Channel", words(selected.channel)],
                    [
                      "Consent",
                      words(selected.consents[0]?.status ?? "UNKNOWN"),
                    ],
                    ["Offer", money(selected.offerHistory[0]?.offerPriceCents)],
                  ]}
                />
                <Panel
                  title="Seller"
                  rows={[
                    [
                      "Contact",
                      selected.recipientLabel ||
                        selected.transaction.property.contactName ||
                        "Not recorded",
                    ],
                    [
                      "Phone",
                      selected.transaction.property.contactPhone ||
                        "Not recorded",
                    ],
                    [
                      "Email",
                      selected.transaction.property.contactEmail ||
                        "Not recorded",
                    ],
                    [
                      "Authority",
                      words(
                        selected.sellerFacts[0]?.authorityStatus ?? "UNKNOWN",
                      ),
                    ],
                    [
                      "Timeline",
                      selected.sellerFacts[0]?.timeline || "Not recorded",
                    ],
                    [
                      "Desired proceeds",
                      money(selected.sellerFacts[0]?.desiredProceedsCents),
                    ],
                  ]}
                />
                <Panel
                  title="Property facts"
                  rows={[
                    [
                      "Owner",
                      selected.transaction.property.ownerName || "Not verified",
                    ],
                    [
                      "Value",
                      selected.transaction.property.estimatedValue
                        ? money(
                            selected.transaction.property.estimatedValue * 100,
                          )
                        : "Not verified",
                    ],
                    [
                      "Lot",
                      selected.transaction.property.lotSize || "Not verified",
                    ],
                    [
                      "Year built",
                      selected.transaction.property.yearBuilt || "Not verified",
                    ],
                    [
                      "Condition",
                      selected.sellerFacts[0]?.propertyCondition ||
                        "Not recorded",
                    ],
                    [
                      "Confidence",
                      `${selected.transaction.property.confidence}%`,
                    ],
                  ]}
                />
                <section className="rounded-xl border p-4">
                  <h3 className="font-bold">Seller statements</h3>
                  {selected.sellerFacts[0]?.priorities.length ? (
                    <ul className="mt-3 list-disc space-y-2 pl-4 text-xs text-slate-600">
                      {selected.sellerFacts[0].priorities.map((priority) => (
                        <li key={priority}>{priority}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      No sourced seller statements recorded.
                    </p>
                  )}
                </section>
                {selected.conversations[0] ? (
                  <details
                    className="rounded-xl border"
                    id="seller-intake"
                    open={!selected.sellerFacts.length}
                  >
                    <summary className="cursor-pointer px-4 py-3 text-sm font-bold">
                      Complete property intake
                    </summary>
                    <SellerFactsForm
                      engagementId={selected.id}
                      conversationId={selected.conversations[0].id}
                      authorityStatuses={[...sellerAuthorityStatuses]}
                      representationStatuses={[...sellerRepresentationStatuses]}
                      channels={[...channels]}
                      current={
                        selected.sellerFacts[0]
                          ? {
                              priorities: selected.sellerFacts[0].priorities,
                              timeline: selected.sellerFacts[0].timeline,
                              propertyCondition:
                                selected.sellerFacts[0].propertyCondition,
                              authorityStatus:
                                selected.sellerFacts[0].authorityStatus,
                              authoritySourceUrl:
                                selected.sellerFacts[0].authoritySourceUrl,
                              representationStatus:
                                selected.sellerFacts[0].representationStatus,
                              preferredChannel:
                                selected.sellerFacts[0].preferredChannel,
                            }
                          : null
                      }
                    />
                  </details>
                ) : null}
                <details className="rounded-xl border" id="follow-up-tools">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-bold">
                    Follow-up and disposition tools
                  </summary>
                  <div className="space-y-4 border-t p-4">
                    <form
                      action={scheduleSellerFollowUpAction}
                      className="space-y-2"
                    >
                      <input
                        name="engagementId"
                        type="hidden"
                        value={selected.id}
                      />
                      <input
                        className={field}
                        name="dueAt"
                        type="datetime-local"
                        required
                      />
                      <input
                        className={field}
                        name="reason"
                        placeholder="Follow-up reason"
                        required
                      />
                      <select className={field} name="channel">
                        <option value="">Existing channel</option>
                        {channels.map((value) => (
                          <option key={value} value={value}>
                            {words(value)}
                          </option>
                        ))}
                      </select>
                      <button className="w-full rounded-lg border px-3 py-2 text-sm font-semibold">
                        Schedule follow-up
                      </button>
                    </form>
                    <form
                      action={recordSellerDispositionAction}
                      className="space-y-2 border-t pt-4"
                    >
                      <input
                        name="engagementId"
                        type="hidden"
                        value={selected.id}
                      />
                      <select className={field} name="reason">
                        {sellerDispositionReasons.map((value) => (
                          <option key={value} value={value}>
                            {words(value)}
                          </option>
                        ))}
                      </select>
                      <textarea
                        className={field}
                        name="explanation"
                        placeholder="Reason or context"
                      />
                      <input
                        className={field}
                        name="nurtureUntil"
                        type="datetime-local"
                      />
                      <button className="w-full rounded-lg border px-3 py-2 text-sm font-semibold">
                        Save outcome
                      </button>
                    </form>
                  </div>
                </details>
              </div>
            ) : null}
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
}

function Panel({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <section className="rounded-xl border p-4">
      <h3 className="font-bold">{title}</h3>
      {rows.map(([label, value]) => (
        <div
          className="mt-3 flex justify-between gap-4 border-t pt-3 text-xs"
          key={label}
        >
          <span className="text-slate-500">{label}</span>
          <strong className="text-right">{value}</strong>
        </div>
      ))}
    </section>
  );
}
