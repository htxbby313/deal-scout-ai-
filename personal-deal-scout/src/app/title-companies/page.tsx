import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

const titleCompanies = [
  {
    name: "Independence Title",
    role: "Statewide / primary candidate",
    coverage: "Broad Texas coverage",
    status: "Contact",
    strengths: ["Residential & land", "Multiple Texas markets", "Remote coordination"],
    url: "https://www.independencetitle.com/",
  },
  {
    name: "Cottonwood Title & Escrow",
    role: "Investor specialist / backup",
    coverage: "Texas investor transactions",
    status: "Contact",
    strengths: ["Assignments", "Double closings", "Transactional funding coordination"],
    url: "https://cottonwoodtc.com/",
  },
  {
    name: "True North Title & Escrow",
    role: "Investor network candidate",
    coverage: "Confirm exact Texas counties",
    status: "Contact",
    strengths: ["Wholesale deals", "Assignment contracts", "Double closings", "Hard-money coordination"],
    url: "https://www.truenorthtitleandescrow.com/",
  },
];

export default async function TitleCompaniesPage() {
  await requireOwner();

  return (
    <WorkspaceShell active="title-companies">
      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Closing network</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Title Companies</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Build a reusable closing network for assignments, direct purchases, land deals, and double closes. Verification is informational, not an approval gate.</p>
            </div>
            <a className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" href="/message-center?view=templates">Title outreach templates</a>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["3", "Companies seeded"],
            ["0", "Verified for assignments"],
            ["0", "Used successfully"],
            ["0", "Preferred closers"],
          ].map(([value, label]) => (
            <div className="rounded-2xl border border-border bg-card p-4" key={label}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Texas Closing Network</h2>
              <p className="mt-1 text-sm text-muted-foreground">Track Uncontacted → Contacted → Verified → Used Successfully → Preferred.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {titleCompanies.map((company) => (
              <article className="rounded-2xl border border-border/80 p-4" key={company.name}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{company.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{company.role}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{company.status}</span>
                </div>
                <p className="mt-4 text-sm"><span className="font-semibold">Coverage:</span> {company.coverage}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {company.strengths.map((strength) => <span className="rounded-full bg-muted px-2.5 py-1 text-xs" key={strength}>{strength}</span>)}
                </div>
                <div className="mt-5 flex gap-2">
                  <a className="rounded-lg border border-border px-3 py-2 text-xs font-semibold" href={company.url} rel="noreferrer" target="_blank">Website</a>
                  <a className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground" href="/message-center?view=templates">Contact</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold">Company profile fields</h2>
            <p className="mt-2 text-sm text-muted-foreground">Next data layer: offices, counties served, escrow contacts, assignment acceptance, assignment-fee disbursement, double-close capability, transactional funding coordination, remote closing, earnest-money instructions, turnaround, required documents, notes, and Primary/Backup designation.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-bold">Deal workflow</h2>
            <p className="mt-2 text-sm text-muted-foreground">Property → Underwrite → Contract → Open Title → Title Review → Clear to Close → Closed. Deal Scout should recommend a closer from verified capabilities without blocking you from selecting another company.</p>
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}
