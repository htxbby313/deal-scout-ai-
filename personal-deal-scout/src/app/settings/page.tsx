import Link from "next/link";
import { saveOwnerProfileAction } from "@/app/owner-profile-actions";
import { ThemeColorPicker } from "@/app/theme-color-picker";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { evaluateGoogleVisualContextEnvironment } from "@/lib/google-visual-context";
import { getOwnerProfile } from "@/lib/owner-profile-store";

const googleBlockerLabels: Record<string, string> = {
  provider_disabled: "Google Maps is disabled",
  browser_key_missing: "browser key missing",
  server_key_missing: "server key missing",
  server_api_restrictions_unverified: "server API restrictions unverified",
  origin_restrictions_unverified: "website restrictions unverified",
  api_restrictions_unverified: "API restrictions unverified",
  quotas_unverified: "usage quota unverified",
  alerts_unverified: "billing alerts unverified",
  attribution_unverified: "map attribution unverified",
  telemetry_unverified: "usage monitoring unverified",
  kill_switch_unverified: "emergency off switch unverified",
  owner_approval_missing: "owner approval date missing",
};

const groups = [
  {
    title: "Deals",
    description: "Approvals, contracts, buyers, and outreach controls.",
    links: [
      ["/transactions", "Approvals & documents"],
      ["/contracts", "Contract templates"],
      ["/buyer-evidence", "Buyer verification"],
      ["/campaigns", "Outreach plans"],
    ],
  },
  {
    title: "Research",
    description: "Research status, national map, and official county sources.",
    links: [
      ["/research", "Research map"],
      ["/operations", "Research activity"],
      ["/county-coverage", "County data sources"],
    ],
  },
  {
    title: "Money & ranking",
    description:
      "Detailed calculations and owner-controlled ranking preferences.",
    links: [
      ["/profitability", "Financial details"],
      ["/profit-priority", "Ranking preferences"],
    ],
  },
  {
    title: "Administration",
    description: "Agent supervision and company record controls.",
    links: [
      ["/agents", "Agent team"],
      ["/governance", "Privacy & records"],
    ],
  },
] as const;

export default async function SettingsPage() {
  await requireOwner();
  const profile = await getOwnerProfile();
  const googleMaps = evaluateGoogleVisualContextEnvironment({
    serverFeaturesRequired: false,
  });
  return (
    <WorkspaceShell active="settings">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="border-b pb-6">
          <p className="text-sm font-semibold text-blue-700">Owner</p>
          <h1 className="mt-1 text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-slate-600">
            Daily work stays in Home, Opportunities, Deals, Contacts, and
            Reports. Open these tools only when you need to change how Deal
            Scout operates.
          </p>
        </header>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">Owner profile</h2>
          <p className="mt-1 text-sm text-slate-500">
            Fills Deal Packages. Single owner only — not a user directory, not
            outbound, not an assistant.
          </p>
          <form action={saveOwnerProfileAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Name
              <input
                className="rounded-xl border px-3 py-2 font-normal"
                defaultValue={profile.displayName}
                name="displayName"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Company
              <input
                className="rounded-xl border px-3 py-2 font-normal"
                defaultValue={profile.companyName}
                name="companyName"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Phone
              <input
                className="rounded-xl border px-3 py-2 font-normal"
                defaultValue={profile.phone}
                name="phone"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Email
              <input
                className="rounded-xl border px-3 py-2 font-normal"
                defaultValue={profile.email}
                name="email"
                type="email"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
              Markets
              <input
                className="rounded-xl border px-3 py-2 font-normal"
                defaultValue={profile.markets.join(", ")}
                name="markets"
                placeholder="Meridian, Boise"
              />
            </label>
            <button className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white sm:col-span-2">
              Save owner profile
            </button>
          </form>
        </section>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">App color</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use one accent color throughout the workspace.
          </p>
          <div className="mt-4 max-w-sm">
            <ThemeColorPicker />
          </div>
        </section>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Google Maps readiness</h2>
              <p className="mt-1 text-sm text-slate-500">
                Credit is separate from activation. Deal Scout uses the free
                map fallback until every cost and key-safety control passes.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${googleMaps.allowed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
              {googleMaps.allowed ? "Ready" : "Safely disabled"}
            </span>
          </div>
          {!googleMaps.allowed ? (
            <ul className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              {googleMaps.blockers.map((blocker) => (
                <li className="rounded-xl bg-slate-50 px-3 py-2" key={blocker}>
                  {googleBlockerLabels[blocker] ?? blocker.replaceAll("_", " ")}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-emerald-800">
              Restricted browser map access is approved. No server Maps credential is required by the current feature set.
            </p>
          )}
        </section>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <section
              className="rounded-2xl border bg-white p-5"
              key={group.title}
            >
              <h2 className="text-lg font-bold">{group.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{group.description}</p>
              <div className="mt-4 grid gap-2">
                {group.links.map(([href, label]) => (
                  <Link
                    className="flex min-h-11 items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold hover:border-blue-300 hover:bg-blue-50"
                    href={href}
                    key={href}
                  >
                    <span>{label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </WorkspaceShell>
  );
}
