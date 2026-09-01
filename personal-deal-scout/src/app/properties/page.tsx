import { createPropertyAction, importPropertiesCsvAction } from "@/app/actions";
import { CsvImportForm } from "@/app/csv-import-form";
import { PropertyBrowser, type PropertyView } from "@/app/properties/property-browser";
import { SubmitButton } from "@/app/submit-button";
import { PageHeader, PrimaryLink, SecondaryLink } from "@/app/ui-foundation";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { calculateMatches, readDatabase } from "@/lib/database";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function AddressField({ name, label, maxLength }: { name: string; label: string; maxLength?: number }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <input className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal" maxLength={maxLength} name={name} required />
    </label>
  );
}

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireOwner();
  const { q = "" } = await searchParams;
  const [db, funnels] = await Promise.all([
    readDatabase(),
    getPrisma().acquisitionFunnel.findMany({ select: { propertyId: true, stage: true } }),
  ]);
  const stageByProperty = new Map(funnels.map((funnel) => [funnel.propertyId, funnel.stage]));
  const developerById = new Map(db.developers.map((developer) => [developer.id, developer]));
  const properties: PropertyView[] = db.properties.map((property) => ({
    ...property,
    pipelineStage: stageByProperty.get(property.id) ?? "DISCOVERED",
    matches: calculateMatches(property, db.developers, db.developerProjects)
      .slice(0, 5)
      .map((match) => ({ ...match, companyName: developerById.get(match.developerId)?.companyName ?? "Unknown buyer" })),
  }));

  return (
    <WorkspaceShell active="properties">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Leads"
          title="Find the next deal worth pursuing"
          description="Review properties, seller contact readiness, and the next useful action. Deal Scout keeps source details available without putting them in your way."
          actions={<><SecondaryLink href="#import-leads">Import CSV</SecondaryLink><PrimaryLink href="#add-lead">Add a lead</PrimaryLink></>}
        />

        <section className="mt-6 scroll-mt-6 rounded-2xl border border-blue-100 bg-blue-50/60 p-5" id="add-lead">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Add one lead</h2>
              <p className="mt-1 text-sm text-slate-600">Enter the address. Research starts automatically after the lead is saved.</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">Only four fields required</span>
          </div>
          <form action={createPropertyAction} className="mt-5 grid gap-3 md:grid-cols-[2fr_1fr_.65fr_.8fr_auto] md:items-end">
            <input name="ownerName" type="hidden" value="Research pending" />
            <AddressField name="address" label="Street address" />
            <AddressField name="city" label="City" />
            <AddressField name="state" label="State" maxLength={2} />
            <AddressField name="zipCode" label="ZIP code" maxLength={10} />
            <SubmitButton className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" idleLabel="Add lead" pendingLabel="Adding…" />
          </form>
        </section>

        <div className="mt-6"><PropertyBrowser initialQuery={q} properties={properties} /></div>

        <section className="mt-8 grid gap-4 lg:grid-cols-2" id="import-leads">
          <details className="rounded-2xl border bg-white p-5">
            <summary className="cursor-pointer font-bold">Import leads from CSV</summary>
            <div className="mt-4">
              <CsvImportForm action={importPropertiesCsvAction} buttonLabel="Import leads" helpText="Imported addresses are checked for duplicates and queued for source-backed research." />
            </div>
          </details>
          <div className="rounded-2xl border bg-white p-5">
            <h2 className="font-bold">Data and research tools</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Zillow intake, county conflicts, source diagnostics, maps, and evidence administration remain available when you need them.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <SecondaryLink href="/research">Open data & sources</SecondaryLink>
              <SecondaryLink href="/operations">Research diagnostics</SecondaryLink>
            </div>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
