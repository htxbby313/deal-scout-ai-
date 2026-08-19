import {
  activateCampaignAction,
  approveCampaignAction,
  pauseCampaignAction,
} from "@/app/campaign-actions";

const field = "rounded-lg border px-3 py-2 text-sm";

export function CampaignLifecycleControls({
  campaigns,
}: {
  campaigns: { id: string; name: string; status: string }[];
}) {
  const control = (
    status: string,
    action: (data: FormData) => Promise<void>,
    label: string,
    button: string,
  ) => (
    <form action={action} className="rounded-2xl border bg-white p-4">
      <b>{label}</b>
      <select className={`${field} mt-3 w-full`} name="campaignId" required>
        <option value="">Select campaign</option>
        {campaigns
          .filter((campaign) => campaign.status === status)
          .map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
      </select>
      <button className="mt-3 rounded-lg bg-slate-950 px-4 py-2 text-white">
        {button}
      </button>
    </form>
  );
  return (
    <>
      <section className="mt-6 grid gap-3 md:grid-cols-3">
        {control(
          "DRAFT",
          approveCampaignAction,
          "Approve bounded campaign",
          "Owner approve",
        )}
        {control(
          "APPROVED",
          activateCampaignAction,
          "Activate verified coverage",
          "Activate",
        )}
        {control("ACTIVE", pauseCampaignAction, "Pause campaign", "Pause")}
      </section>
      <p className="mt-2 text-xs text-slate-500">
        Lifecycle changes never enable outbound delivery. Activation requires
        owner approval, live dates, a current boundary, and persisted county
        coverage.
      </p>
    </>
  );
}
