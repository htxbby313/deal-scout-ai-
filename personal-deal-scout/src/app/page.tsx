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
  typeof value === "number" && value > 0
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : "Unknown";

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

function Field({ name, placeholder, type = "text", required = false }: { name: string; placeholder: string; type?: string; required?: boolean }) {
  return <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name={name} placeholder={placeholder} type={type} required={required} />;
}

function crmValue(notes: string | undefined, label: string) {
  const line = notes?.split("\n").find((entry) => entry.startsWith(`${label}:`));
  return line?.slice(label.length + 1).trim();
}

export default async function Home() {
  await requireOwner();
  const db = await readDatabase();
  const selectedProperty = db.properties[0];
  const matches = selectedProperty ? await scoreDeveloperMatches(selectedProperty.id, false) : [];
  const developerById = new Map(db.developers.map((developer) => [developer.id, developer]));
  const projectsByDeveloper = new Map(db.developers.map((developer) => [developer.id, db.developerProjects.filter((project) => project.developerId === developer.id)]));
  const activeBuyers = db.developers.filter((developer) => crmValue(developer.notes, "Buying status") === "Actively Buying").length;
  const verifiedBuyBoxes = db.developers.filter((developer) => crmValue(developer.notes, "Evidence level") === "Directly Confirmed").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl bg-slate-950 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-300">Deal Scout</p>
          <h1 className="mt-2 text-3xl font-semibold">Developer and buyer intelligence CRM</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Build a verified buyer network first. Track who is buying, what they want, the evidence behind it, and when their criteria need to be refreshed. Then search and match properties against that network.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2 text-sm">
            <a className="rounded-lg bg-white px-3 py-2 font-semibold text-slate-950" href="#buyer-crm">Buyer CRM</a>
            <a className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200" href="#purchase-history">Purchase history</a>
            <a className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200" href="#property-search">Properties</a>
            <a className="rounded-lg border border-slate-600 px-3 py-2 text-slate-200" href="#matches">Matches</a>
          </nav>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <Card><p className="text-sm text-slate-500">Buyer records</p><p className="mt-2 text-3xl font-semibold">{db.developers.length}</p></Card>
          <Card><p className="text-sm text-slate-500">Actively buying</p><p className="mt-2 text-3xl font-semibold">{activeBuyers}</p></Card>
          <Card><p className="text-sm text-slate-500">Directly confirmed buy boxes</p><p className="mt-2 text-3xl font-semibold">{verifiedBuyBoxes}</p></Card>
        </section>

        <Card id="buyer-crm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Buyer CRM</h2>
              <p className="mt-1 text-sm text-slate-600">Every developer found belongs here, even when their buying status is still unknown.</p>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">Primary workflow</span>
          </div>

          <form action={createDeveloperAction} className="mt-5 grid gap-3 md:grid-cols-3">
            <Field name="companyName" placeholder="Company name" required />
            <Field name="contactName" placeholder="Acquisitions contact" />
            <Field name="email" placeholder="Email" type="email" />
            <Field name="phone" placeholder="Phone" />
            <Field name="website" placeholder="Website" />
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="buyingStatus" defaultValue="Discovered">
              <option>Discovered</option><option>Researching</option><option>Buy Box Requested</option><option>Buy Box Received</option><option>Actively Buying</option><option>Selective / Paused</option><option>Not Buying</option><option>Unresponsive</option><option>Do Not Contact</option>
            </select>
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="evidenceLevel" defaultValue="Inferred">
              <option>Directly Confirmed</option><option>Observed Activity</option><option>Inferred</option><option>Unverified</option>
            </select>
            <Field name="targetMarkets" placeholder="Target cities, counties, states" />
            <Field name="targetZipCodes" placeholder="Target ZIPs, comma-separated" />
            <Field name="propertyTypes" placeholder="Land, multifamily, retail, etc." />
            <Field name="acreageRange" placeholder="Acreage range" />
            <Field name="maximumPurchasePrice" placeholder="Maximum purchase price" type="number" />
            <Field name="typicalBuildPrice" placeholder="Typical finished value" type="number" />
            <Field name="entitlementPreference" placeholder="Raw, entitled, either" />
            <Field name="utilityRequirements" placeholder="Utilities and frontage requirements" />
            <Field name="dealStructure" placeholder="Cash, terms, JV, takedown" />
            <Field name="buyBoxSource" placeholder="Source or proof URL" />
            <Field name="lastVerified" placeholder="Last verified date" type="date" />
            <Field name="nextFollowUp" placeholder="Next follow-up" type="date" />
            <textarea className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-3" name="notes" placeholder="Additional acquisition criteria, contact notes, restrictions, or context" />
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white md:col-span-3">Add buyer to CRM</button>
          </form>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="pb-3">Company</th><th className="pb-3">Status</th><th className="pb-3">Evidence</th><th className="pb-3">Buy box</th><th className="pb-3">Capacity</th><th className="pb-3">Follow-up</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {db.developers.map((developer) => (
                  <tr key={developer.id}>
                    <td className="py-4"><p className="font-semibold">{developer.companyName}</p><p className="text-xs text-slate-500">{developer.contactName || "Contact needed"} · {developer.email || "Email needed"}</p></td>
                    <td className="py-4"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">{crmValue(developer.notes, "Buying status") || "Discovered"}</span></td>
                    <td className="py-4">{crmValue(developer.notes, "Evidence level") || "Unverified"}</td>
                    <td className="py-4"><p>{crmValue(developer.notes, "Property types") || "Unknown asset type"}</p><p className="text-xs text-slate-500">{crmValue(developer.notes, "Acreage range") || "Acreage unknown"} · {developer.targetZipCodes.join(", ")}</p></td>
                    <td className="py-4">{money(developer.maximumPurchasePrice)}</td>
                    <td className="py-4">{crmValue(developer.notes, "Next follow-up") || "Not scheduled"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!db.developers.length ? <p className="py-8 text-center text-sm text-slate-500">No buyer records yet.</p> : null}
          </div>
        </Card>

        <Card id="purchase-history">
          <h2 className="text-xl font-semibold">Purchase history and observed activity</h2>
          <p className="mt-1 text-sm text-slate-600">Record actual acquisitions so the system can separate stated buy boxes from demonstrated behavior.</p>
          <form action={createDeveloperProjectAction} className="mt-5 grid gap-3 md:grid-cols-4">
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="developerId" required><option value="">Select buyer</option>{db.developers.map((developer) => <option value={developer.id} key={developer.id}>{developer.companyName}</option>)}</select>
            <Field name="address" placeholder="Acquisition address" required />
            <Field name="city" placeholder="City" required />
            <Field name="state" placeholder="State" required />
            <Field name="zipCode" placeholder="ZIP" required />
            <Field name="originalPurchasePrice" placeholder="Purchase price" type="number" />
            <Field name="newBuildSalePrice" placeholder="Finished value" type="number" />
            <Field name="lotSquareFeet" placeholder="Lot square feet" type="number" />
            <textarea className="min-h-20 rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-4" name="notes" placeholder="Source, closing date, acreage, entitlement, project type, and proof" />
            <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white md:col-span-4">Add purchase evidence</button>
          </form>
        </Card>

        <Card id="property-search">
          <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">Property search and intake</h2><p className="mt-1 text-sm text-slate-600">Secondary workflow: add properties only after the buyer network gives the search direction.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">Phase 2</span></div>
          <form action={createPropertyAction} className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field name="address" placeholder="Street address" required /><Field name="ownerName" placeholder="Owner or listing contact" required /><Field name="city" placeholder="City" required /><Field name="state" placeholder="State" required /><Field name="zipCode" placeholder="ZIP" required /><Field name="estimatedValue" placeholder="Asking price" type="number" required /><Field name="lotSize" placeholder="Lot size or acreage" /><Field name="yearBuilt" placeholder="Year built" />
            <textarea className="min-h-24 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 lg:col-span-4" name="notes" placeholder="Zoning, utilities, frontage, restrictions, days on market, price changes, development angle, source link" />
            <button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white sm:col-span-2 lg:col-span-4">Save property candidate</button>
          </form>
        </Card>

        <section id="matches" className="grid scroll-mt-24 gap-6 xl:grid-cols-[0.7fr_1.3fr]">
          <Card><h2 className="text-xl font-semibold">Run buyer matching</h2><form action={scoreDeveloperMatchesAction} className="mt-4 space-y-3"><select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="propertyId" required defaultValue={selectedProperty?.id}>{db.properties.map((property) => <option value={property.id} key={property.id}>{property.address}, {property.city} · {money(property.estimatedValue)}</option>)}</select><button className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Score against buyer CRM</button></form></Card>
          <Card><h2 className="text-xl font-semibold">Ranked matches</h2><p className="mt-1 text-sm text-slate-600">Current scoring uses geography, purchase history, capacity, and finished-product value. Unverified records remain visible but should not be treated as confirmed buyers.</p><div className="mt-4 space-y-3">{matches.slice(0, 10).map((match, index) => { const developer = developerById.get(match.developerId); if (!developer || !selectedProperty) return null; const projects = projectsByDeveloper.get(developer.id) ?? []; return <article className="rounded-xl border border-slate-200 p-4" key={developer.id}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-slate-500">Match #{index + 1}</p><h3 className="mt-1 text-lg font-semibold">{developer.companyName}</h3><p className="text-sm text-slate-600">{crmValue(developer.notes, "Buying status") || "Discovered"} · {crmValue(developer.notes, "Evidence level") || "Unverified"} · {projects.length} known purchase(s)</p></div><div className="rounded-xl bg-blue-50 px-4 py-2 text-center"><p className="text-2xl font-bold text-blue-800">{match.score}</p><p className="text-xs font-semibold text-blue-700">score</p></div></div><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul><form action={generateDeveloperPricingRequestAction} className="mt-4"><input type="hidden" name="propertyId" value={selectedProperty.id} /><input type="hidden" name="developerId" value={developer.id} /><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Create buy-box or deal outreach draft</button></form></article>; })}{!matches.length ? <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Build the buyer list, add purchase evidence, and save a property before running matches.</p> : null}</div></Card>
        </section>
      </div>
    </main>
  );
}
