import {
  activateBoundedOutreachAction,
  pauseBoundedOutreachAction,
  runBoundedOutreachNowAction,
} from "@/app/campaign-actions";

const field = "rounded-lg border px-3 py-2 text-sm";

type Campaign = { id: string; name: string; status: string };
type Authorization = {
  id: string;
  campaignId: string;
  status: string;
  audience: string;
  allowedChannels: string[];
  maximumMessagesPerDay: number;
  maximumMessagesPerRecipient: number;
  maximumFollowUpsPerRecipient: number;
  startsAt: Date;
  expiresAt: Date;
  deliveries: { id: string; status: string }[];
};

export function BoundedOutreachControls({
  campaigns,
  authorizations,
}: {
  campaigns: Campaign[];
  authorizations: Authorization[];
}) {
  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE",
  );
  return (
    <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
            Controlled autonomy
          </p>
          <h2 className="mt-1 text-xl font-bold">
            Seller and buyer outreach authority
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            One owner activation authorizes routine email or text delivery only
            for the campaign&apos;s current approved property and buyer
            snapshot. Suppression, permission, provider, transaction, content,
            daily-volume, recipient, and expiration gates are rechecked before
            every send.
          </p>
        </div>
        <form action={runBoundedOutreachNowAction}>
          <button className="rounded-lg border bg-white px-4 py-2 text-sm font-bold">
            Run authorized outreach now
          </button>
        </form>
      </div>

      <form
        action={activateBoundedOutreachAction}
        className="mt-5 grid gap-3 rounded-xl border bg-white p-4 lg:grid-cols-4"
      >
        <label className="text-sm font-semibold">
          Campaign
          <select className={`${field} mt-1 w-full`} name="campaignId" required>
            <option value="">Select active campaign</option>
            {activeCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Audience
          <select
            className={`${field} mt-1 w-full`}
            name="audience"
            defaultValue="BOTH"
          >
            <option value="BOTH">Sellers and buyers</option>
            <option value="SELLER">Sellers only</option>
            <option value="BUYER">Buyers only</option>
          </select>
        </label>
        <fieldset className="text-sm font-semibold">
          <legend>Channels</legend>
          <div className="mt-2 flex gap-4">
            <label>
              <input
                name="channels"
                type="checkbox"
                value="EMAIL"
                defaultChecked
              />{" "}
              Email
            </label>
            <label>
              <input name="channels" type="checkbox" value="SMS" /> Text
            </label>
          </div>
        </fieldset>
        <label className="text-sm font-semibold">
          Daily maximum
          <input
            className={`${field} mt-1 w-full`}
            name="maximumMessagesPerDay"
            type="number"
            min="1"
            max="100"
            defaultValue="10"
          />
        </label>
        <label className="text-sm font-semibold">
          Per-recipient maximum
          <input
            className={`${field} mt-1 w-full`}
            name="maximumMessagesPerRecipient"
            type="number"
            min="1"
            max="5"
            defaultValue="3"
          />
        </label>
        <label className="text-sm font-semibold">
          Follow-up maximum
          <input
            className={`${field} mt-1 w-full`}
            name="maximumFollowUpsPerRecipient"
            type="number"
            min="0"
            max="3"
            defaultValue="2"
          />
        </label>
        <label className="text-sm font-semibold">
          Seller offer ceiling (optional)
          <input
            className={`${field} mt-1 w-full`}
            name="sellerOfferCeiling"
            inputMode="decimal"
            placeholder="$250,000"
          />
        </label>
        <label className="text-sm font-semibold">
          Starts
          <input
            className={`${field} mt-1 w-full`}
            name="startsAt"
            type="datetime-local"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          Expires
          <input
            className={`${field} mt-1 w-full`}
            name="expiresAt"
            type="datetime-local"
            required
          />
        </label>
        <label className="text-sm font-semibold lg:col-span-2">
          Required disclosure
          <input
            className={`${field} mt-1 w-full`}
            name="requiredDisclosure"
            defaultValue="Reply STOP to opt out."
          />
        </label>
        <label className="text-sm font-semibold lg:col-span-2">
          Prohibited claims, one per line
          <textarea
            className={`${field} mt-1 min-h-24 w-full`}
            name="prohibitedClaims"
            defaultValue={
              "guaranteed profit\nclear title\nconfirmed zoning\ncommitted buyer"
            }
          />
        </label>
        <label className="text-sm font-semibold lg:col-span-2">
          Escalate immediately when, one per line
          <textarea
            className={`${field} mt-1 min-h-24 w-full`}
            name="escalationTriggers"
            defaultValue={
              "price or terms change\nlegal or title question\nrepresentation or agency question\ncomplaint or opt-out\ncontract or commitment request"
            }
          />
        </label>
        <div className="flex items-end lg:col-span-4">
          <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">
            Activate controlled outreach
          </button>
        </div>
      </form>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {authorizations.map((authorization) => {
          const sent = authorization.deliveries.filter(
            (delivery) => delivery.status === "SENT",
          ).length;
          const blocked = authorization.deliveries.filter(
            (delivery) => delivery.status === "BLOCKED",
          ).length;
          return (
            <article
              className="rounded-xl border bg-white p-4"
              key={authorization.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <b>
                    {authorization.audience.replace(
                      "BOTH",
                      "Sellers and buyers",
                    )}
                  </b>
                  <p className="mt-1 text-xs text-slate-500">
                    {authorization.allowedChannels.join(" + ")} ·{" "}
                    {authorization.maximumMessagesPerDay}/day ·{" "}
                    {authorization.maximumMessagesPerRecipient}/recipient ·
                    expires {authorization.expiresAt.toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">
                  {authorization.status}
                </span>
              </div>
              <p className="mt-3 text-sm">
                {sent} sent · {blocked} blocked ·{" "}
                {authorization.deliveries.length} recent delivery records
              </p>
              {authorization.status === "ACTIVE" ? (
                <form action={pauseBoundedOutreachAction} className="mt-3">
                  <input
                    type="hidden"
                    name="authorizationId"
                    value={authorization.id}
                  />
                  <button className="rounded-lg border px-3 py-2 text-sm font-bold">
                    Pause immediately
                  </button>
                </form>
              ) : null}
            </article>
          );
        })}
        {!authorizations.length ? (
          <p className="text-sm text-slate-500">
            No autonomous outreach authority is active. Research and drafting
            continue without sending.
          </p>
        ) : null}
      </div>
    </section>
  );
}
