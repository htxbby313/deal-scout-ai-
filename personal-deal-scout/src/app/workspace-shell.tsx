import Link from "next/link";
import type { ReactNode } from "react";
import { contextualNavigation, moreNavigation, primaryNavigation } from "@/lib/workspace-nav";

type WorkspaceSection =
  | "owner-queue"
  | "governance"
  | "contracts"
  | "executive"
  | "profitability"
  | "profit-priority"
  | "campaigns"
  | "seller-crm"
  | "county-coverage"
  | "pipeline"
  | "agents"
  | "buyer-evidence"
  | "transactions"
  | "operations"
  | "disposition"
  | "research"
  | "developers"
  | "properties"
  | "settings"
  | "deals"
  | "message-center";

export function WorkspaceShell({
  active = "properties",
  children,
}: {
  active?: WorkspaceSection;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[248px_1fr]">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <aside className="sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur lg:flex lg:h-dvh lg:min-h-0 lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-4 lg:block lg:px-5 lg:py-5">
          <Link className="flex items-center gap-3" href="/owner-queue">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-700 text-xs font-bold text-white">
              DS
            </span>
            <span>
              <span className="block text-base font-bold">Deal Scout</span>
              <span className="block text-[11px] text-slate-500">
                Find. Analyze. Close.
              </span>
            </span>
          </Link>
          <span className="mt-4 hidden w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 lg:inline-block">
            Live
          </span>
        </div>

        <div className="hidden px-5 pb-4 lg:block">
          <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Acquisitions · Private</p>
          </div>
        </div>

        <nav
          aria-label="Primary"
          className="grid grid-cols-5 gap-1 px-2 pb-3 lg:min-h-0 lg:flex-1 lg:block lg:space-y-1.5 lg:overflow-x-hidden lg:overflow-y-auto lg:px-3"
        >
          {primaryNavigation.map((item) => {
            const selected = (item.active as readonly string[]).includes(
              active,
            );
            return (
              <Link
                aria-current={selected ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition sm:text-xs lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm ${
                  selected
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                href={item.href}
                key={item.href}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold ${
                    selected
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {(() => {
          const group = active === "seller-crm" || active === "developers" || active === "buyer-evidence" || active === "disposition" ? "people" : active === "message-center" || active === "campaigns" ? "communications" : active === "transactions" || active === "contracts" ? "transactions" : active === "owner-queue" ? null : "deals";
          const tabs = group ? contextualNavigation[group] : [];
          return tabs.length ? <div className="mx-3 mb-4 rounded-xl border border-border/70 bg-muted/30 p-2"><p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>{tabs.map(([href, label]) => <Link className="block rounded-lg px-2 py-2 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground" href={href} key={href}>{label}</Link>)}</div> : null;
        })()}

        <details className="mx-3 mb-[max(1rem,env(safe-area-inset-bottom))] shrink-0 rounded-xl border border-border/70 bg-card">
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-semibold text-slate-700 marker:hidden">
            <span className="flex items-center justify-between gap-3">
              <span>More</span>
              <span aria-hidden="true" className="text-slate-400">
                ⌄
              </span>
            </span>
          </summary>
          <div className="overflow-x-hidden border-t border-slate-100 p-2">
            {moreNavigation.map(([href, label]) => (
              <Link
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
          </div>
        </details>
      </aside>

      <main className="min-w-0" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
