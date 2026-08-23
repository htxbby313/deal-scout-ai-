import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeColorPicker } from "@/app/theme-color-picker";

const primaryNavigation = [
  { href: "/owner-queue", label: "Dashboard", icon: "H", active: ["owner-queue"] },
  { href: "/properties", label: "Properties", icon: "P", active: ["properties"] },
  { href: "/developers", label: "Developers & Buyers", icon: "D", active: ["developers"] },
  { href: "/research", label: "Research Map", icon: "R", active: ["research"] },
  { href: "/pipeline", label: "Deals", icon: "→", active: ["pipeline", "transactions", "seller-crm", "disposition", "contracts", "campaigns"] },
  { href: "/executive", label: "Profit & Reports", icon: "$", active: ["executive", "profitability", "profit-priority"] },
] as const;

const settingsNavigation = [
  { label: "Deal workflow", items: [
    { href: "/transactions", label: "Approvals & documents" },
    { href: "/seller-crm", label: "Seller conversations" },
    { href: "/disposition", label: "Buyer matching" },
    { href: "/campaigns", label: "Outreach plans" },
    { href: "/contracts", label: "Contract templates" },
    { href: "/buyer-evidence", label: "Buyer verification" },
  ] },
  { label: "Research & money", items: [
    { href: "/operations", label: "Research activity" },
    { href: "/county-coverage", label: "County data sources" },
    { href: "/profitability", label: "Financial details" },
    { href: "/profit-priority", label: "Ranking preferences" },
  ] },
  { label: "Administration", items: [
    { href: "/agents", label: "Agent team" },
    { href: "/governance", label: "Privacy & records" },
  ] },
] as const;

type WorkspaceSection =
  | "owner-queue" | "governance" | "contracts" | "executive" | "profitability"
  | "profit-priority" | "campaigns" | "seller-crm" | "county-coverage" | "pipeline"
  | "agents" | "buyer-evidence" | "transactions" | "operations" | "disposition"
  | "research" | "developers" | "properties";

export function WorkspaceShell({ active = "properties", children }: { active?: WorkspaceSection; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-950 lg:grid lg:grid-cols-[240px_1fr]">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur lg:flex lg:h-dvh lg:min-h-0 lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r">
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-5 lg:block lg:px-6">
          <Link className="flex items-center gap-3" href="/owner-queue">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white">DS</span>
            <span><span className="block text-lg font-bold">Deal Scout</span><span className="block text-xs text-slate-500">Acquisitions workspace</span></span>
          </Link>
          <span className="mt-4 hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 lg:inline-block">Research active</span>
        </div>

        <nav aria-label="Primary" className="flex gap-2 overflow-x-auto px-4 pb-4 lg:min-h-0 lg:flex-1 lg:block lg:space-y-2 lg:overflow-x-hidden lg:overflow-y-auto lg:px-4">
          {primaryNavigation.map((item) => {
            const selected = (item.active as readonly string[]).includes(active);
            return (
              <Link aria-current={selected ? "page" : undefined} className={`flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${selected ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50"}`} href={item.href} key={item.href}>
                <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${selected ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <details className="mx-4 mb-[max(1.25rem,env(safe-area-inset-bottom))] shrink-0 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-700 marker:hidden">
            <span className="flex items-center justify-between gap-3"><span><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs text-white">O</span>Owner</span><span aria-hidden="true" className="text-slate-400">⌄</span></span>
          </summary>
          <div className="max-h-[min(20rem,calc(100dvh-10rem-env(safe-area-inset-bottom)))] overflow-x-hidden overflow-y-auto border-t border-slate-100 p-2">
            {settingsNavigation.map((group) => <div className="not-first:mt-2" key={group.label}><p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">{group.label}</p>{group.items.map((item) => <Link className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-950" href={item.href} key={item.href}>{item.label}</Link>)}</div>)}
            <div className="mt-2 border-t border-slate-100 px-2 pt-3"><ThemeColorPicker /></div>
          </div>
        </details>
      </aside>
      <main className="min-w-0" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
