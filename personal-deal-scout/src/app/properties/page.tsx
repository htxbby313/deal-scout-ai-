import { createPropertyAction, importPropertiesCsvAction } from "@/app/actions";
import { CsvImportForm } from "@/app/csv-import-form";
import {
  PropertyBrowser,
  type PropertyView,
} from "@/app/properties/property-browser";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import { readDatabase, scoreDeveloperMatches } from "@/lib/database";
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
    <input
      className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
      name={name}
      placeholder={placeholder}
      type={type}
      required={required}
    />
  );
}

export default async function PropertiesPage() {
  await requireOwner();
  const db = await readDatabase();
  const countyEvidence = await getPrisma().countyFactObservation.findMany({
    where: { propertyId: { not: null } },
    include: {
      property: { select: { address: true } },
      source: { select: { agencyName: true, officialDomain: true } },
    },
    orderBy: { observedAt: "desc" },
    take: 50,
  });
  const developerById = new Map(
    db.developers.map((developer) => [developer.id, developer]),
  );
  const properties: PropertyView[] = await Promise.all(
    db.properties.map(async (property) => ({
      ...property,
      matches: (await scoreDeveloperMatches(property.id, false))
        .slice(0, 5)
        .map((match) => ({
          ...match,
          companyName:
            developerById.get(match.developerId)?.companyName ??
            "Unknown developer",
        })),
    })),
  );
  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              Source-backed opportunities
            </p>
            <h1 className="mt-1 text-3xl font-bold">Properties</h1>
            <p className="mt-2 text-sm text-slate-600">
              Actionable opportunities require confirmed availability, original
              evidence, a current asking price, a usable contact, and dated
              verification evidence.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"
              href="#import-properties"
            >
              Import CSV
            </a>
            <a
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
              href="#add-property"
            >
              Add evidence
            </a>
          </div>
        </header>
        <div className="mt-6">
          <PropertyBrowser properties={properties} />
        </div>
        <section className="mt-6 rounded-2xl border bg-white p-5">
          <h2 className="font-bold">County evidence and conflicts</h2>
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
        </section>
        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <details
            className="rounded-2xl border bg-white p-5 shadow-sm"
            id="import-properties"
            open
          >
            <summary className="cursor-pointer font-bold">
              Add properties from a spreadsheet
            </summary>
            <div className="mt-4">
              <CsvImportForm
                action={importPropertiesCsvAction}
                buttonLabel="Import properties"
                helpText="Every imported record is queued for automatic public-source research. Unsupported facts remain in Needs verification until evidence is captured."
              />
            </div>
          </details>
          <details
            className="rounded-2xl border bg-white p-5 shadow-sm"
            id="add-property"
          >
            <summary className="cursor-pointer font-bold">
              Add one property
            </summary>
            <form
              action={createPropertyAction}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <Field name="address" placeholder="Street address" required />
              <Field name="ownerName" placeholder="Owner or agency" required />
              <Field name="city" placeholder="City" required />
              <Field name="state" placeholder="State" required />
              <Field name="zipCode" placeholder="ZIP" required />
              <Field name="county" placeholder="County" />
              <Field
                name="neighborhood"
                placeholder="Neighborhood or subdivision"
              />
              <Field name="propertyType" placeholder="Verified property type" />
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
              <select
                className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                name="opportunityStatus"
                required
                defaultValue="NEEDS_VERIFICATION"
              >
                <option value="NEEDS_VERIFICATION">Needs verification</option>
                <option value="DEVELOPMENT_SIGNAL">Development signal</option>
                <option value="CONFIRMED_AVAILABLE">Confirmed available</option>
                <option value="GOVERNMENT_SALE">Government sale</option>
              </select>
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
              <textarea
                className="min-h-24 rounded-xl border p-3 text-sm sm:col-span-2"
                name="notes"
                placeholder="Zoning, utilities, document number, and research notes"
              />
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">
                Add property
              </button>
            </form>
          </details>
        </section>
      </div>
    </WorkspaceShell>
  );
}
