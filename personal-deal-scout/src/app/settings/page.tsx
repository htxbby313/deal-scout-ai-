import Link from "next/link";
import { ThemeColorPicker } from "@/app/theme-color-picker";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";

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
  return (
    <WorkspaceShell active="settings">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="border-b pb-6">
          <p className="text-sm font-semibold text-blue-700">Owner</p>
          <h1 className="mt-1 text-3xl font-bold">Settings</h1>
          <p className="mt-2 text-sm text-slate-600">
            Daily work stays in the six main tabs. Open these tools only when
            you need to change how Deal Scout operates.
          </p>
        </header>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">App color</h2>
          <p className="mt-1 text-sm text-slate-500">
            Use one accent color throughout the workspace.
          </p>
          <div className="mt-4 max-w-sm">
            <ThemeColorPicker />
          </div>
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
