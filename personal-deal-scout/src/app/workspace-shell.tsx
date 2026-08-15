"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [{ href: "/developers", label: "Developers", icon: "D" }, { href: "/properties", label: "Properties", icon: "P" }];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-[#f4f7fb] text-slate-950 lg:grid lg:grid-cols-[240px_1fr]">
    <aside className="border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between px-5 py-5 lg:block lg:px-6"><Link className="flex items-center gap-3" href="/developers"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-sm font-bold text-white">DS</span><span><span className="block text-lg font-bold">Deal Scout</span><span className="block text-xs text-slate-500">Acquisitions CRM</span></span></Link><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 lg:mt-6 lg:inline-block">Research mode</span></div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-2 lg:px-4">{navigation.map((item) => { const active = pathname.startsWith(item.href); return <Link className={`flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold ${active ? "bg-blue-50 text-blue-800" : "text-slate-600 hover:bg-slate-50"}`} href={item.href} key={item.href}><span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold ${active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>{item.label}</Link>; })}</nav>
      <p className="hidden px-6 text-xs leading-5 text-slate-500 lg:absolute lg:bottom-6 lg:block">Outbound messaging stays disabled until a provider is reviewed and explicitly enabled.</p>
    </aside><main className="min-w-0">{children}</main>
  </div>;
}
