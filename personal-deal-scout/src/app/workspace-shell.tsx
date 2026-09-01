import Link from "next/link";
import type { ReactNode } from "react";

type IconName = "today" | "leads" | "deals" | "buyers" | "reports";

export const primaryNavigation = [
  { href: "/owner-queue", label: "Today", icon: "today", active: ["owner-queue", "agents"] },
  { href: "/properties", label: "Leads", icon: "leads", active: ["properties", "research", "operations", "county-coverage"] },
  { href: "/pipeline", label: "Deals", icon: "deals", active: ["pipeline", "seller-crm", "transactions", "campaigns", "contracts"] },
  { href: "/developers", label: "Buyers", icon: "buyers", active: ["developers", "buyer-evidence", "disposition"] },
  { href: "/executive", label: "Reports", icon: "reports", active: ["executive", "profitability", "profit-priority"] },
] as const;

const sectionNavigation = {
  Today: [["/owner-queue", "Next actions"]],
  Leads: [["/properties", "All leads"], ["/research", "Market research"]],
  Deals: [["/pipeline", "Deal pipeline"], ["/seller-crm", "Seller conversations"], ["/transactions", "Approvals"]],
  Buyers: [["/developers", "Buyer list"], ["/disposition", "Deal matching"]],
  Reports: [["/executive", "Business summary"], ["/profitability", "Financial details"]],
} as const;

export type WorkspaceSection =
  | "owner-queue" | "governance" | "contracts" | "executive"
  | "profitability" | "profit-priority" | "campaigns" | "seller-crm"
  | "county-coverage" | "pipeline" | "agents" | "buyer-evidence"
  | "transactions" | "operations" | "disposition" | "research"
  | "developers" | "properties" | "settings";

function NavigationIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    today: <><path d="M5 3.5v3M19 3.5v3M3.5 9h17" /><path d="M5.5 5h13a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" /><path d="m8.5 15 2 2 5-5" /></>,
    leads: <><path d="M4 20V9.5L12 3l8 6.5V20" /><path d="M8.5 20v-6h7v6M3 20h18" /></>,
    deals: <><path d="M4 7.5h16v11H4zM8 7.5V5h8v2.5" /><path d="M4 12h6m4 0h6M10 10.5v3h4v-3" /></>,
    buyers: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 15.5a4.5 4.5 0 0 1 6.5 4" /></>,
    reports: <><path d="M4 20V10m5 10V4m6 16v-7m5 7V7" /><path d="M2.5 20.5h19" /></>,
  };
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}

export function primaryDestinationFor(active: WorkspaceSection) {
  return primaryNavigation.find((item) => (item.active as readonly string[]).includes(active))?.label ?? null;
}

export function WorkspaceShell({ active = "properties", children }: { active?: WorkspaceSection; children: ReactNode }) {
  const selectedPrimary = primaryNavigation.find((item) => (item.active as readonly string[]).includes(active));
  const sectionLinks = selectedPrimary ? sectionNavigation[selectedPrimary.label] : [];
  return (
    <div className="min-h-screen bg-[#f4f6f8] text-slate-950 lg:grid lg:grid-cols-[232px_1fr]">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur lg:flex lg:h-dvh lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Link className="flex items-center gap-3 rounded-xl" href="/owner-queue">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-sm font-extrabold tracking-tight text-white shadow-sm">DS</span>
            <span><span className="block text-base font-bold tracking-tight">Deal Scout</span><span className="block text-xs text-slate-500">Acquisitions workspace</span></span>
          </Link>
        </div>
        <nav aria-label="Primary" className="grid grid-cols-5 gap-1 px-2 pb-2 lg:min-h-0 lg:flex-1 lg:block lg:space-y-1 lg:overflow-y-auto lg:px-3">
          {primaryNavigation.map((item) => {
            const selected = (item.active as readonly string[]).includes(active);
            return (
              <Link aria-current={selected ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm ${selected ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`} href={item.href} key={item.href}>
                <span className={`grid h-8 w-8 place-items-center rounded-lg ${selected ? "bg-blue-700 text-white" : "text-slate-500"}`}><NavigationIcon name={item.icon} /></span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        {sectionLinks.length ? (
          <nav aria-label={`${selectedPrimary?.label} section`} className="hidden border-t border-slate-100 px-3 py-3 lg:block lg:space-y-1">
            <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{selectedPrimary?.label}</p>
            {sectionLinks.map(([href, label]) => <Link className={`block rounded-lg px-3 py-2 text-sm font-semibold ${href === `/${active}` ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`} href={href} key={href}>{label}</Link>)}
          </nav>
        ) : null}
        <details className="mx-3 mb-[max(.75rem,env(safe-area-inset-bottom))] shrink-0 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-slate-700 marker:hidden"><span className="flex items-center justify-between gap-3"><span>More</span><span aria-hidden="true" className="text-slate-400">⌄</span></span></summary>
          <div className="grid grid-cols-2 border-t border-slate-100 p-2 lg:block">
            {[["/settings", "Settings"], ["/agents", "Automations"], ["/research", "Data & sources"], ["/contracts", "Contracts"], ["/operations", "Diagnostics"]].map(([href, label]) => <Link className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" href={href} key={href}>{label}</Link>)}
          </div>
        </details>
      </aside>
      <main className="min-w-0" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  );
}
