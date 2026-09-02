import { createPropertyAction, importPropertiesCsvAction } from "@/app/actions";
import { CsvImportForm } from "@/app/csv-import-form";
import {
  PropertyBrowser,
  type PropertyView,
} from "@/app/properties/property-browser";
import { WorkspaceShell } from "@/app/workspace-shell";
import { SubmitButton } from "@/app/submit-button";
import { registerZillowReferenceAction } from "@/app/deal-desk-actions";
import { requireOwner } from "@/lib/auth";
import { calculateMatches, readDatabase } from "@/lib/database";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
function Field({
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-700">
      <span>
        {placeholder}
        {required ? (
          <span aria-hidden="true" className="text-red-700">
            {" "}
            *
          </span>
        ) : null}
      </span>
      <input
        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal"
        name={name}
        placeholder={placeholder}
        type={type}
        required={required}
      />
    </label>
  );
}

export default async function PropertiesPage() {
  await requireOwner();
  const db = await readDatabase();
  const [countyEvidence, funnels] = await Promise.all([
    getPrisma().countyFactObservation.findMany({
      where: { propertyId: { not: null } },
      include: {
        property: { select: { address: true } },
        source: { select: { agencyName: true, officialDomain: true } },
      },
      orderBy: { observedAt: "desc" },
      take: 50,
    }),
    getPrisma().acquisitionFunnel.findMany({
      select: { propertyId: true, stage: true },
    }),
  ]);
  const stageByProperty = new Map(
    funnels.map((funnel) => [funnel.propertyId, funnel.stage]),
  );
  const developerById = new Map(
    db.developers.map((developer) => [developer.id, developer]),
  );
  const properties: PropertyView[] = db.properties.map((property) => ({
    ...property,
    pipelineStage: stageByProperty.get(property.id) ?? "DISCOVERED",
    matches: calculateMatches(property, db.developers, db.developerProjects)
      .slice(0, 5)
      .map((match) => ({
        ...match,
        companyName:
          developerById.get(match.developerId)?.companyName ??
          "Unknown developer",
      })),
  }));
  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="border-b pb-6">
          <p className="text-sm font-semibold text-blue-700">
            Source-backed opportunities
          </p>
          <h1 className="mt-1 text-3xl font-bold">Opportunities</h1>
          <p className="mt-2 text-sm text-slate-600">
            Open Analyze on an address to work the deal. Import stays out of the
            way until you need it.
          </p>
        </header>
        <div className="mt-6">
          <PropertyBrowser properties={properties} />
        </div>
        <details className="mt-6 rounded-2xl border bg-white p-5" id="add-or-import">
          <summary className="cursor-pointer font-bold">Add or import</summary>
          <div className="mt-4 grid gap-6 xl:grid-cols-2">
            <div id="import-properties">
              <h2 className="font-bold">Add properties from a spreadsheet</h2>
              <div className="mt-3">
                <CsvImportForm
                  action={importPropertiesCsvAction}
                  buttonLabel="Import properties"
                  helpText="Every imported record is queued for automatic public-source research. Unsupported facts remain in Needs verification until evidence is captured."
                />
              </div>
            </div>
            <div id="add-property">
              <h2 className="font-bold">Add one property</h2>
              <p className="mt-3 text-sm text-slate-600">
                Only the address is required to start. Deal Scout will look for
                ownership, parcel, tax, zoning, utility, listing, contact, and
                development evidence.
              </p>
              <form
                action={createPropertyAction}
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                <input name="ownerName" type="hidden" value="Research pending" />
                <Field name="address" placeholder="Street address" required />
                <Field name="city" placeholder="City" required />
                <Field name="state" placeholder="State" required />
                <Field name="zipCode" placeholder="ZIP" required />
                <details className="rounded-xl border border-slate-200 p-4 sm:col-span-2">
                  <summary className="cursor-pointer text-sm font-bold text-slate-700">
                    Add known details (optional)
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field name="county" placeholder="County" />
                    <Field
                      name="neighborhood"
                      placeholder="Neighborhood or subdivision"
                    />
                    <Field
                      name="propertyType"
                      placeholder="Verified property type"
                    />
                    <Field
                      name="latitude"
                      placeholder="Latitude (research can fill this)"
                      type="number"
                    />
                    <Field
                      name="longitude"
                      placeholder="Longitude (research can fill this)"
                      type="number"
                    />
                    <Field
                      name="estimatedValue"
                      placeholder="Asking or estimated value"
                      type="number"
                    />
                    <Field name="lotSize" placeholder="Lot size or acreage" />
                    <Field name="yearBuilt" placeholder="Year built" />
                    <label className="grid gap-1 text-sm font-semibold text-slate-700">
                      <span>Starting status</span>
                      <select
                        className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal"
                        name="opportunityStatus"
                        required
                        defaultValue="NEEDS_VERIFICATION"
                      >
                        <option value="NEEDS_VERIFICATION">
                          Needs verification
                        </option>
                        <option value="DEVELOPMENT_SIGNAL">
                          Development signal
                        </option>
                        <option value="CONFIRMED_AVAILABLE">
                          Confirmed available
                        </option>
                        <option value="GOVERNMENT_SALE">Government sale</option>
                      </select>
                    </label>
                    <Field
                      name="confidence"
                      placeholder="Confidence 0–100"
                      type="number"
                    />
                    <Field
                      name="contactName"
                      placeholder="Seller or agency contact"
                    />
                    <Field
                      name="contactPhone"
                      placeholder="Required phone (research can find it)"
                    />
                    <Field
                      name="contactEmail"
                      placeholder="Contact email"
                      type="email"
                    />
                    <Field
                      name="contactUrl"
                      placeholder="Official contact/listing page"
                      type="url"
                    />
                    <Field
                      name="sourceName"
                      placeholder="Government or listing source"
                    />
                    <Field
                      name="sourceUrl"
                      placeholder="Official source URL"
                      type="url"
                    />
                    <Field
                      name="sourceRecordDate"
                      placeholder="Record/listing date"
                    />
                    <label className="grid gap-1 text-sm font-semibold text-slate-700 sm:col-span-2">
                      <span>Known notes</span>
                      <textarea
                        className="min-h-24 rounded-xl border p-3 text-sm font-normal"
                        name="notes"
                        placeholder="Zoning, utilities, document number, and research notes"
                      />
                    </label>
                  </div>
                </details>
                <SubmitButton
                  className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2"
                  idleLabel="Start property research"
                  pendingLabel="Adding property and starting research…"
                />
              </form>
            </div>
          </div>
          <details className="mt-6 rounded-xl border p-4">
            <summary className="cursor-pointer font-bold">
              Zillow Scout Inbox
            </summary>
            <p className="mt-2 text-sm text-slate-600">
              Record a human-selected Zillow property link without server-side
              page scraping. Deal Scout will match an existing opportunity or
              create a verification-stage record, then run normal official-source
              research.
            </p>
            <form
              action={registerZillowReferenceAction}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <input
                className="rounded-lg border px-3 py-2 sm:col-span-2"
                name="url"
                placeholder="Direct Zillow property URL"
                required
                type="url"
              />
              <input
                className="rounded-lg border px-3 py-2"
                name="observedAddress"
                placeholder="Street address"
                required
              />
              <input
                className="rounded-lg border px-3 py-2"
                name="observedCity"
                placeholder="City"
                required
              />
              <input
                className="rounded-lg border px-3 py-2"
                maxLength={2}
                minLength={2}
                name="observedState"
                placeholder="State"
                required
              />
              <input
                className="rounded-lg border px-3 py-2"
                name="observedZipCode"
                placeholder="ZIP code"
                required
              />
              <input
                className="rounded-lg border px-3 py-2"
                name="observedAskingPrice"
                placeholder="Observed asking price"
                type="number"
              />
              <input
                className="rounded-lg border px-3 py-2"
                name="observedAvailability"
                placeholder="Observed availability"
              />
              <textarea
                className="rounded-lg border px-3 py-2 sm:col-span-2"
                name="observationNotes"
                placeholder="Observation notes"
              />
              <button className="rounded-xl bg-slate-950 px-4 py-3 font-bold text-white sm:col-span-2">
                Add to Scout Inbox
              </button>
            </form>
          </details>
          <details className="mt-4 rounded-xl border p-4">
            <summary className="cursor-pointer font-bold">
              County evidence and conflicts · {countyEvidence.length}
            </summary>
            <p className="text-xs text-slate-500">
              Persisted observations only. Conflicted and manual-review records
              are not verified facts.
            </p>
            {countyEvidence.map((item) => (
              <article className="mt-3 border-t pt-3 text-sm" key={item.id}>
                <b>
                  {item.property?.address} · {item.fieldName}
                </b>
                <p>
                  {item.status} · confidence {item.confidence} ·{" "}
                  {item.source.agencyName}
                </p>
                <a
                  className="text-xs text-blue-700 underline"
                  href={item.source.officialDomain}
                  target="_blank"
                  rel="noreferrer"
                >
                  Official source domain
                </a>
                {item.conflictDetails ? (
                  <pre className="overflow-auto text-xs text-red-700">
                    {JSON.stringify(item.conflictDetails, null, 2)}
                  </pre>
                ) : null}
              </article>
            ))}
          </details>
        </details>
      </div>
    </WorkspaceShell>
  );
}
