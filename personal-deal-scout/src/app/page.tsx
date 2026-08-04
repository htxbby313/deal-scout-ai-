import {
  createDeveloperAction,
  createDeveloperProjectAction,
  createPropertyAction,
  generateDeveloperPricingRequestAction,
  scoreDeveloperMatchesAction,
} from "@/app/actions";
import { readDatabase, scoreDeveloperMatches } from "@/lib/database";
import { requireOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

const money = (value?: number) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : "Not entered";

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

function Field({ name, placeholder, type = "text", required = false }: { name: string; placeholder: string; type?: string; required?: boolean }) {
  return <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name={name} placeholder={placeholder} type={type} required={required} />;
}

export default async function Home() {
  await requireOwner();
  const db = await readDatabase();
  const selectedProperty = db.properties[0];
  const matches = selectedProperty ? await scoreDeveloperMatches(selectedProperty.id, false) : [];
  const developerById = new Map(db.developers.map((developer) => [developer.id, developer]));
  const projectsByDeveloper = new Map(
    db.developers.map((developer) => [developer.id, db.developerProjects.filter((project) => project.developerId === developer.id)]),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-slate-950 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Deal Scout</p>
          <h1 className="mt-2 text-3xl font-semibold">Property-to-buyer disposition engine</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Enter one property, maintain evidence about real developers and buyers, rank the strongest matches, and create a reviewable outreach draft. Nothing is sent automatically.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold">1. Add the property</h2>
            <p className="mt-1 text-sm text-slate-600">Use the current asking price or your expected contract price as estimated value.</p>
            <form action={createPropertyAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field name="address" placeholder="Street address" required />
              <Field name="ownerName" placeholder="Owner or listing contact" required />
              <Field name="city" placeholder="City" required />
              <Field name="state" placeholder="State" required />
              <Field name="zipCode" placeholder="ZIP code" required />
              <Field name="estimatedValue" placeholder="Asking price" type="number" required />
              <Field name="lotSize" placeholder="Lot size or acreage" />
              <Field name="yearBuilt" placeholder="Year built" />
              <textarea className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" name="notes" placeholder="Zoning, utilities, frontage, restrictions, days on market, price drops, development angle, source link" />
              <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Save property</button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">2. Add a likely buyer or developer</h2>
            <p className="mt-1 text-sm text-slate-600">Only add prospects supported by buying criteria or documented project history.</p>
            <form action={createDeveloperAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field name="companyName" placeholder="Company name" required />
              <Field name="contactName" placeholder="Acquisitions contact" />
              <Field name="email" placeholder="Email" type="email" />
              <Field name="phone" placeholder="Phone" />
              <Field name="website" placeholder="Website" />
              <Field name="targetZipCodes" placeholder="Target ZIPs, comma-separated" required />
              <Field name="maximumPurchasePrice" placeholder="Maximum purchase price" type="number" />
              <Field name="typicalBuildPrice" placeholder="Typical finished value" type="number" />
              <textarea className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2" name="notes" placeholder="Asset type, acreage range, entitlement preferences, evidence source, acquisition thesis" />
              <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white sm:col-span-2">Save buyer profile</button>
            </form>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-semibold">3. Record proof of prior purchases</h2>
          <p className="mt-1 text-sm text-slate-600">This is the evidence behind reverse acquisition matching.</p>
          <form action={createDeveloperProjectAction} className="mt-4 grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="developerId" required>
              <option value="">Select buyer or developer</option>
              {db.developers.map((developer) => <option value={developer.id} key={developer.id}>{developer.companyName}</option>)}
            </select>
            <Field name="address" placeholder="Prior acquisition address" required />
            <Field name="city" placeholder="City" required />
            <Field name="state" placeholder="State" required />
            <Field name="zipCode" placeholder="ZIP" required />
            <Field name="originalPurchasePrice" placeholder="Purchase price" type="number" />
            <Field name="newBuildSalePrice" placeholder="Finished sale value" type="number" />
            <Field name="lotSquareFeet" placeholder="Lot square feet" type="number" />
            <textarea className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-4" name="notes" placeholder="Source, closing date, acreage, use, entitlement or subdivision details" />
            <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white md:col-span-4">Add purchase evidence</button>
          </form>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <h2 className="text-lg font-semibold">4. Select and score a property</h2>
            <form action={scoreDeveloperMatchesAction} className="mt-4 space-y-3">
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="propertyId" required defaultValue={selectedProperty?.id}>
                {db.properties.map((property) => (
                  <option value={property.id} key={property.id}>{property.address}, {property.city} • {money(property.estimatedValue)}</option>
                ))}
              </select>
              <button className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Run buyer matching</button>
            </form>

            {selectedProperty ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold">Current property</p>
                <p className="mt-1">{selectedProperty.address}, {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zipCode}</p>
                <p className="mt-1">Price: {money(selectedProperty.estimatedValue)}</p>
                <p className="mt-1">Land: {selectedProperty.lotSize || "Not entered"}</p>
              </div>
            ) : <p className="mt-4 text-sm text-slate-600">Add a property to begin.</p>}
          </Card>

          <Card>
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">5. Ranked buyer matches</h2>
                <p className="mt-1 text-sm text-slate-600">Scores use ZIP coverage, same-city purchase history, purchasing capacity, and finished-product value.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{matches.length} matches</span>
            </div>

            <div className="mt-4 space-y-3">
              {matches.slice(0, 10).map((match, index) => {
                const developer = developerById.get(match.developerId);
                if (!developer || !selectedProperty) return null;
                const projects = projectsByDeveloper.get(developer.id) ?? [];
                return (
                  <article className="rounded-xl border border-slate-200 p-4" key={developer.id}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Match #{index + 1}</p>
                        <h3 className="mt-1 text-lg font-semibold">{developer.companyName}</h3>
                        <p className="mt-1 text-sm text-slate-600">{developer.contactName || "Decision-maker not entered"} • {projects.length} recorded purchase(s)</p>
                      </div>
                      <div className="rounded-xl bg-blue-50 px-4 py-2 text-center">
                        <p className="text-2xl font-bold text-blue-800">{match.score}</p>
                        <p className="text-xs font-semibold text-blue-700">match score</p>
                      </div>
                    </div>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {match.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                    <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                      <span>Capacity: {money(developer.maximumPurchasePrice)}</span>
                      <span>Typical build: {money(developer.typicalBuildPrice)}</span>
                      <span>Target ZIPs: {developer.targetZipCodes.join(", ")}</span>
                    </div>
                    <form action={generateDeveloperPricingRequestAction} className="mt-4">
                      <input type="hidden" name="propertyId" value={selectedProperty.id} />
                      <input type="hidden" name="developerId" value={developer.id} />
                      <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Create outreach draft</button>
                    </form>
                  </article>
                );
              })}
              {!matches.length ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">Add buyer profiles and purchase evidence, then run matching.</p> : null}
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-semibold">6. Review outreach drafts</h2>
          <p className="mt-1 text-sm text-slate-600">Drafts are generated for review only. No automatic sending.</p>
          <div className="mt-4 space-y-3">
            {db.messageApprovals.map((draft) => (
              <article className="rounded-xl border border-slate-200 p-4" key={draft.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">{draft.recipientLabel}</p>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{draft.status}</span>
                </div>
                {draft.subject ? <p className="mt-3 text-sm font-semibold">{draft.subject}</p> : null}
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{draft.body}</p>
              </article>
            ))}
            {!db.messageApprovals.length ? <p className="text-sm text-slate-600">No drafts yet.</p> : null}
          </div>
        </Card>
      </div>
    </main>
  );
}
