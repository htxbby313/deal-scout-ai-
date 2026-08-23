import Link from "next/link";
import {
  createDeveloperAction,
  createDeveloperProjectAction,
  importDevelopersCsvAction,
} from "@/app/actions";
import { CsvImportForm } from "@/app/csv-import-form";
import { WorkspaceShell } from "@/app/workspace-shell";
import { requireOwner } from "@/lib/auth";
import {
  readDatabase,
  scoreDeveloperMatches,
  type QualificationStatus,
} from "@/lib/database";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const labels: Record<QualificationStatus, string> = {
  PRIORITY: "Priority",
  QUALIFIED: "Relationship ready",
  LIMITED_CONTACT: "Limited contact",
  RESEARCH_NEEDED: "Research needed",
  REJECTED: "Rejected",
};
const money = (value?: number) =>
  value
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value)
    : "Unknown";
function crmValue(notes: string | undefined, label: string) {
  const line = notes
    ?.split("\n")
    .find((entry) => entry.startsWith(`${label}:`));
  return line?.slice(label.length + 1).trim();
}
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
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

export default async function DevelopersPage({
  searchParams,
}: {
  searchParams: Promise<{
    developer?: string;
    q?: string;
    view?: string;
    sort?: string;
  }>;
}) {
  await requireOwner();
  const params = await searchParams;
  const db = await readDatabase();
  const view = params.view === "research" ? "research" : "qualified";
  const qualified: QualificationStatus[] = ["PRIORITY", "QUALIFIED"];
  const research: QualificationStatus[] = [
    "RESEARCH_NEEDED",
    "LIMITED_CONTACT",
  ];
  const statuses = view === "qualified" ? qualified : research;
  const query = params.q?.trim().toLowerCase() ?? "";
  const developerRankCategory =
    params.sort === "recent"
      ? "Recently updated"
      : params.sort === "status"
        ? "Qualification status"
        : "Company A–Z";
  const visible = db.developers
    .filter(
      (developer) =>
        statuses.includes(developer.qualificationStatus) &&
        [
          developer.companyName,
          developer.contactName,
          developer.email,
          crmValue(developer.notes, "Target markets"),
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query)),
    )
    .toSorted((a, b) =>
      params.sort === "recent"
        ? b.updatedAt.localeCompare(a.updatedAt)
        : params.sort === "status"
          ? a.qualificationStatus.localeCompare(b.qualificationStatus)
          : a.companyName.localeCompare(b.companyName),
    );
  const selected =
    visible.find((developer) => developer.id === params.developer) ??
    visible[0];
  const countyMatches = selected
    ? await getPrisma().countyEntityMatch.findMany({
        where: { developerId: selected.id },
        include: {
          source: { select: { agencyName: true, officialDomain: true } },
          property: { select: { address: true } },
        },
        orderBy: { observedAt: "desc" },
        take: 50,
      })
    : [];
  const projects = selected
    ? db.developerProjects
        .filter(
          (project) =>
            project.developerId === selected.id &&
            project.verifiedAt &&
            project.sourceUrl,
        )
        .toSorted((a, b) =>
          (b.sourceRecordDate || "").localeCompare(a.sourceRecordDate || ""),
        )
    : [];
  const matches = selected
    ? (
        await Promise.all(
          db.properties.map(async (property) => ({
            property,
            match: (await scoreDeveloperMatches(property.id, false)).find(
              (item) => item.developerId === selected.id,
            ),
          })),
        )
      )
        .filter((item) => item.match)
        .sort((a, b) => (b.match?.score ?? 0) - (a.match?.score ?? 0))
    : [];
  const qualifiedCount = db.developers.filter((developer) =>
    qualified.includes(developer.qualificationStatus),
  ).length;
  const researchCount = db.developers.filter((developer) =>
    research.includes(developer.qualificationStatus),
  ).length;

  return (
    <WorkspaceShell active="developers">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-700">
              Developer intelligence
            </p>
            <h1 className="mt-1 text-3xl font-bold">Developer Relationship List</h1>
            <p className="mt-2 text-sm text-slate-600">
              Developers enter the working list when a usable public website,
              business email, or business phone is available. Buy boxes and
              capacity evidence determine deal readiness later.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold"
              href="#import-buyers"
            >
              Import CSV
            </a>
            <a
              className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white"
              href="#add-buyer"
            >
              Add candidate
            </a>
          </div>
        </header>
        <nav className="mt-6 flex gap-2">
          <Link
            className={`rounded-full px-4 py-2 text-sm font-bold ${view === "qualified" ? "bg-slate-950 text-white" : "bg-white ring-1 ring-slate-200"}`}
            href="/developers?view=qualified"
          >
            Relationship ready · {qualifiedCount}
          </Link>
          <Link
            className={`rounded-full px-4 py-2 text-sm font-bold ${view === "research" ? "bg-amber-600 text-white" : "bg-white ring-1 ring-slate-200"}`}
            href="/developers?view=research"
          >
            Research needed · {researchCount}
          </Link>
        </nav>
        <section className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b p-4">
              <form className="grid gap-2">
                <input type="hidden" name="view" value={view} />
                <input
                  className="w-full rounded-xl border bg-slate-50 px-4 py-2.5 text-sm"
                  defaultValue={params.q}
                  name="q"
                  placeholder="Search company, market, contact…"
                />
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  defaultValue={params.sort || "company"}
                  name="sort"
                >
                  <option value="company">Company A–Z</option>
                  <option value="status">Qualification status</option>
                  <option value="recent">Recently updated</option>
                </select>
                <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white">
                  Apply
                </button>
              </form>
              <p className="mt-3 text-xs text-slate-500">
                {visible.length} record{visible.length === 1 ? "" : "s"} ·
                ranked by {developerRankCategory}
              </p>
            </div>
            <div className="max-h-[720px] divide-y overflow-y-auto">
              {visible.map((developer, index) => (
                <Link
                  className={`flex gap-3 p-4 ${developer.id === selected?.id ? "bg-blue-50" : "hover:bg-slate-50"}`}
                  href={`/developers?view=${view}&developer=${developer.id}&sort=${params.sort || "company"}`}
                  key={developer.id}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-950 text-sm font-bold text-white">
                    #{index + 1}
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate">{developer.companyName}</b>
                    <span className="block truncate text-xs text-slate-500">
                      {developer.contactName || "Decision-maker needed"}
                    </span>
                    <span className="mt-2 inline-block rounded-full bg-white px-2 py-1 text-[11px] font-semibold ring-1 ring-slate-200">
                      {labels[developer.qualificationStatus]}
                    </span>
                  </span>
                </Link>
              ))}
              {!visible.length ? (
                <div className="p-5">
                  <Empty>
                    {view === "qualified"
                      ? "No developers qualify yet. Verify a government record plus a usable contact route."
                      : "The research queue is clear."}
                  </Empty>
                </div>
              ) : null}
            </div>
          </aside>
          {selected ? (
            <div className="space-y-6">
              <section className="rounded-2xl border bg-white p-5">
                <h3 className="font-bold">
                  County entity evidence and conflicts
                </h3>
                <p className="text-xs text-slate-500">
                  Persisted matches only. Manual-review or conflicted records do
                  not qualify this developer.
                </p>
                {countyMatches.map((item) => (
                  <article className="mt-3 border-t pt-3 text-sm" key={item.id}>
                    <b>
                      {item.matchedName} · {item.status}
                    </b>
                    <p>
                      {item.property?.address || "Developer-level match"} ·
                      confidence {item.confidence} · {item.source.agencyName}
                    </p>
                    <p className="text-xs">{item.rationale}</p>
                    <a
                      className="text-xs text-blue-700 underline"
                      href={item.source.officialDomain}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Official source domain
                    </a>
                    {item.conflictingEvidence ? (
                      <pre className="overflow-auto text-xs text-red-700">
                        {JSON.stringify(item.conflictingEvidence, null, 2)}
                      </pre>
                    ) : null}
                  </article>
                ))}
              </section>
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <div className="flex flex-col justify-between gap-5 lg:flex-row">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {selected.companyName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selected.contactName || "Decision-maker not identified"}
                    </p>
                    <span className="mt-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                      {labels[selected.qualificationStatus]}
                    </span>
                  </div>
                  <div className="text-sm lg:text-right">
                    <p
                      className={
                        selected.email
                          ? "font-semibold text-emerald-700"
                          : "text-red-700"
                      }
                    >
                      {selected.email || "Email missing"}
                    </p>
                    <p
                      className={
                        selected.phone
                          ? "font-semibold text-emerald-700"
                          : "text-red-700"
                      }
                    >
                      {selected.phone || "Phone missing"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {projects.length} verified project
                      {projects.length === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-blue-700">
                      Research:{" "}
                      {selected.researchRuns[0]?.status
                        .toLowerCase()
                        .replaceAll("_", " ") || "automatic queue pending"}
                    </p>
                  </div>
                </div>
                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  <article className="rounded-xl border p-4">
                    <b>Demonstrated buy box</b>
                    <p className="mt-3 text-sm">
                      {crmValue(selected.notes, "Property types") ||
                        "Asset focus needs verification"}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {crmValue(selected.notes, "Target markets") ||
                        "Markets will be derived from projects"}
                    </p>
                  </article>
                  <article className="rounded-xl border p-4">
                    <b>Qualification</b>
                    <ul className="mt-3 space-y-2 text-sm">
                      <li>{selected.email ? "✓" : "○"} Valid email</li>
                      <li>{selected.phone ? "✓" : "○"} Valid phone</li>
                      <li>{selected.contactName ? "✓" : "○"} Named contact</li>
                      <li>{projects.length ? "✓" : "○"} Verified project</li>
                    </ul>
                  </article>
                  <article className="rounded-xl border p-4">
                    <b>Actionable matches · {matches.length}</b>
                    <div className="mt-3 space-y-2">
                      {matches.slice(0, 3).map(({ property, match }) => (
                        <div
                          className="rounded-lg bg-slate-50 p-3 text-sm"
                          key={property.id}
                        >
                          <b>{property.address}</b>
                          <p className="text-xs text-slate-500">
                            {property.city}, {property.state} · score{" "}
                            {match?.score}
                          </p>
                        </div>
                      ))}
                      {!matches.length ? (
                        <p className="text-sm text-slate-500">
                          No verified property matches.
                        </p>
                      ) : null}
                    </div>
                  </article>
                </div>
              </section>
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold">Verified project history</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Source links are mandatory. Marketing claims do not count.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {projects.map((project) => (
                    <article className="rounded-xl border p-4" key={project.id}>
                      <b>{project.address}</b>
                      <p className="text-sm text-slate-500">
                        {project.city}, {project.state} ·{" "}
                        {money(project.originalPurchasePrice)}
                      </p>
                      <a
                        className="mt-3 inline-block text-xs font-bold text-blue-700 underline"
                        href={project.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open {project.sourceName || "government source"}
                      </a>
                      <p className="mt-2 text-xs text-slate-500">
                        Record: {project.sourceRecordDate} · Confidence:{" "}
                        {project.confidence}%
                      </p>
                    </article>
                  ))}
                  {!projects.length ? (
                    <Empty>No verified project evidence recorded.</Empty>
                  ) : null}
                </div>
              </section>
            </div>
          ) : (
            <section className="rounded-2xl border bg-white p-10">
              <Empty>Select a record or import candidates into research.</Empty>
            </section>
          )}
        </section>
        <section className="mt-8 grid gap-6 xl:grid-cols-2">
          <details
            className="rounded-2xl border bg-white p-5 shadow-sm"
            id="import-buyers"
            open
          >
            <summary className="cursor-pointer font-bold">
              Import developers into research
            </summary>
            <div className="mt-4">
              <CsvImportForm
                action={importDevelopersCsvAction}
                buttonLabel="Import developers"
                helpText="Every import is queued for automatic public-source research. Qualification still requires source-backed project history plus a usable contact route."
              />
            </div>
          </details>
          <details
            className="rounded-2xl border bg-white p-5 shadow-sm"
            id="add-buyer"
          >
            <summary className="cursor-pointer font-bold">
              Add one research candidate
            </summary>
            <form
              action={createDeveloperAction}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <Field name="companyName" placeholder="Company" required />
              <Field name="contactName" placeholder="Decision-maker or team" />
              <Field name="email" placeholder="Email" type="email" />
              <Field name="phone" placeholder="Phone" />
              <Field name="website" placeholder="Website" type="url" />
              <Field
                name="contactUrl"
                placeholder="Official land submission or contact URL"
                type="url"
              />
              <Field name="targetMarkets" placeholder="Markets" />
              <Field name="propertyTypes" placeholder="Asset focus" />
              <Field name="notes" placeholder="Acquisition criteria" />
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">
                Add and start research
              </button>
            </form>
          </details>
        </section>
        {selected ? (
          <details className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
            <summary className="cursor-pointer font-bold">
              Add verified project for {selected.companyName}
            </summary>
            <p className="mt-2 text-sm text-slate-500">
              Use a county recorder, assessor, SEC filing, or another official
              government record.
            </p>
            <form
              action={createDeveloperProjectAction}
              className="mt-4 grid gap-3 md:grid-cols-4"
            >
              <input type="hidden" name="developerId" value={selected.id} />
              <Field
                name="address"
                placeholder="Recorded project or property"
                required
              />
              <Field name="city" placeholder="City" required />
              <Field name="state" placeholder="State" required />
              <Field name="zipCode" placeholder="ZIP" required />
              <Field
                name="originalPurchasePrice"
                placeholder="Original purchase price (if known)"
                type="number"
              />
              <Field
                name="newBuildSalePrice"
                placeholder="Finished value"
                type="number"
              />
              <Field
                name="lotSquareFeet"
                placeholder="Lot square feet"
                type="number"
              />
              <Field
                name="sourceRecordDate"
                placeholder="Record date"
                required
              />
              <Field
                name="sourceName"
                placeholder="Government source"
                required
              />
              <Field
                name="sourceUrl"
                placeholder="Official record URL"
                type="url"
                required
              />
              <Field
                name="confidence"
                placeholder="Confidence 1–100"
                type="number"
                required
              />
              <Field name="notes" placeholder="Document number" />
              <button className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white md:col-span-4">
                Verify and save project
              </button>
            </form>
          </details>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
