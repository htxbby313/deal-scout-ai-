import {
  developers,
  developerProjects,
  messageDrafts,
  metrics,
  money,
  neighborhoods,
} from "@/lib/seed-data";
import {
  approveMessageAction,
  blockedSendAttemptAction,
  createDeveloperAction,
  createDeveloperProjectAction,
  createLeadAction,
  createMessageTemplateAction,
  createPropertyAction,
  generateDeveloperPricingRequestAction,
  generateDraftAction,
  rejectMessageAction,
  runSchedulerAction,
  scoreDeveloperMatchesAction,
} from "@/app/actions";
import { databaseInfo, readDatabase, scoreDeveloperMatches } from "@/lib/database";

export const dynamic = "force-dynamic";

const navItems = [
  "Dashboard",
  "Opportunities",
  "Developers",
  "Properties",
  "Deals",
  "Messages",
];

const statusColumns = [
  "READY_TO_CONTACT",
  "CONTACT_DAY_1",
  "CONTACT_DAY_2",
  "INTAKE_RECEIVED",
  "WAITING_ON_DEVELOPER",
  "DEVELOPER_PRICE_RECEIVED",
  "UNDER_CONTRACT",
];

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const tones = {
    neutral: "border-slate-300 bg-slate-200 text-slate-700",
    good: "border-green-300 bg-green-100 text-green-800",
    warn: "border-yellow-300 bg-yellow-100 text-yellow-800",
    danger: "border-red-300 bg-red-100 text-red-800",
  };

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function Card({
  children,
  className = "",
  ...props
}: React.ComponentPropsWithoutRef<"section"> & { children: React.ReactNode }) {
  return (
    <section className={`rounded-lg border border-slate-300 bg-slate-100/85 p-5 shadow-sm shadow-slate-300/30 ${className}`} {...props}>
      {children}
    </section>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {detail ? <p className="mt-1 text-sm text-slate-600">{detail}</p> : null}
      </div>
    </div>
  );
}

export default async function Home() {
  const db = readDatabase();
  const info = databaseInfo();
  const realLeads = db.leads;
  const realProperties = db.properties;
  const bestLead = realLeads[0];
  const leadProperties = new Map(realProperties.map((property) => [property.id, property]));
  const bestProperty = leadProperties.get(bestLead.propertyId);
  const selectedMatchProperty = realProperties[0];
  const developerMatches = selectedMatchProperty ? scoreDeveloperMatches(selectedMatchProperty.id, false).slice(0, 5) : [];
  const developerById = new Map(db.developers.map((developer) => [developer.id, developer]));
  const groupedTasks = db.tasks.reduce<Record<string, typeof db.tasks>>((acc, task) => {
    const group = task.priority === "Urgent" || task.priority === "High" ? "Must Do Today" : task.type === "SCHEDULED_FOLLOW_UP" ? "High-Value Follow-Ups" : "Research Tasks";
    acc[group] = [...(acc[group] ?? []), task];
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-blue-200 bg-slate-100/95 backdrop-blur">
        <div className="px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">Private System</p>
                <h1 className="mt-1 text-lg font-semibold text-blue-800">Deal Scout</h1>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-100 px-3 py-2">
                <span className="text-xs font-medium uppercase text-yellow-800">{info.systemMode}</span>
                <span className="hidden text-xs text-slate-600 sm:inline">Outbound disabled</span>
              </div>
            </div>
            <nav className="flex gap-2 overflow-x-auto pb-1 xl:max-w-[980px] xl:justify-end">
              {navItems.map((item) => (
                <a
                  className="whitespace-nowrap rounded-md border border-slate-300 bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800"
                  href={`#${item.toLowerCase().replaceAll(" ", "-")}`}
                  key={item}
                >
                  {item}
                </a>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="px-5 pb-6 pt-32 sm:px-7 sm:pt-28 lg:px-8 xl:pt-24">
        <div className="mx-auto max-w-[1600px]">
          <section id="dashboard" className="scroll-mt-32">
            <div className="mb-6 flex flex-col gap-4 border-b border-slate-300 pb-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-500">Daily Money Plan</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">Highest-probability actions first</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50">Add Candidate</button>
              <a className="rounded-md border border-blue-300 bg-slate-100 px-4 py-2 text-sm font-medium text-blue-800" href="#research">Research Notes</a>
              <button className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-800">Pause System</button>
            </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card className="border-blue-300 bg-blue-50">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-blue-700">Best Action Today</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    {bestLead.nextActionType} about {bestProperty?.address ?? "the top opportunity"}
                  </h2>
                </div>
                <Badge tone="warn">{money(bestLead.estimatedAssignmentFee)}</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_260px]">
                <div>
                  <p className="text-sm leading-6 text-slate-700">{bestLead.notes ?? "This is the highest-priority saved lead based on current task order."}</p>
                  <ul className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <li>Seller: {bestLead.ownerName}</li>
                    <li>Next action: {bestLead.nextActionAt}</li>
                    <li>Priority: {bestLead.priority}</li>
                    <li>Mode: {info.systemMode}</li>
                  </ul>
                </div>
                <div className="grid gap-2">
                  {["Open Lead", "Mark Complete", "Snooze", "Create Call Note"].map((label, index) => (
                    <button
                      className={`rounded-md px-4 py-2 text-sm font-medium ${
                        index === 0 ? "bg-blue-700 text-blue-50" : "border border-blue-300 bg-blue-100 text-blue-800"
                      }`}
                      key={label}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle title="Revenue Snapshot" detail="Estimates are not guaranteed profit." />
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Potential Revenue" value={money(metrics.potentialAssignmentRevenue)} />
                <Metric label="Closed Revenue" value={money(metrics.closedRevenue)} />
                <Metric label="Under Contract" value={String(metrics.dealsUnderContract)} />
                <Metric label="Offers Worked" value={String(metrics.offersBeingWorked)} />
              </div>
            </Card>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="New Opportunities" value={metrics.newOpportunities} />
            <MetricCard label="High-Priority Leads" value={metrics.highPriorityLeads} />
            <MetricCard label="Follow-Ups Due" value={metrics.followUpsDue} />
            <MetricCard label="Developer Replies Needed" value={metrics.developerRepliesNeeded} />
            </div>

            <Card className="mt-4 border-blue-200 bg-slate-100">
              <SectionTitle title="Auto-Populated Task Queue" detail="Daily actions generated from lead status, reply timing, developer demand, and estimated fee." />
              <div className="grid gap-3 lg:grid-cols-4">
                {Object.entries(groupedTasks).map(([group, groupTasks]) => (
                  <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3" key={group}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{group}</h3>
                    <div className="grid gap-2">
                      {groupTasks.map((task) => (
                        <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2" key={task.title}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{task.title}</p>
                              <p className="mt-1 text-xs text-slate-600">Due {task.dueAt}</p>
                            </div>
                            <Badge tone={task.priority === "Urgent" || task.priority === "High" ? "warn" : "neutral"}>{task.priority}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
              <Card>
                <SectionTitle title="Add Property" detail="Saves to the local database and records an audit event." />
                <form action={createPropertyAction} className="grid gap-3 sm:grid-cols-2">
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="address" placeholder="Property address" required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="ownerName" placeholder="Owner name" required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="city" placeholder="City" required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="state" placeholder="TX" maxLength={2} required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="zipCode" placeholder="Zip code" required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="yearBuilt" placeholder="Year built" />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="lotSize" placeholder="Lot size" />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="notes" placeholder="Notes" />
                  <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50 sm:col-span-2">Save Property</button>
                </form>
              </Card>

              <Card>
                <SectionTitle title="Create Lead" detail="Creates the lead, next task, and audit log entry." />
                <form action={createLeadAction} className="grid gap-3 sm:grid-cols-2">
                  <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="propertyId" required>
                    {realProperties.map((property) => (
                      <option value={property.id} key={property.id}>{property.address}</option>
                    ))}
                  </select>
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="ownerName" placeholder="Owner name" required />
                  <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="status" defaultValue="READY_TO_CONTACT">
                    <option>READY_TO_CONTACT</option>
                    <option>CONTACT_DAY_1</option>
                    <option>WAITING_ON_DEVELOPER</option>
                    <option>DEVELOPER_PRICE_RECEIVED</option>
                    <option>UNDER_CONTRACT</option>
                  </select>
                  <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="priority" defaultValue="High">
                    <option>Urgent</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="nextActionType" placeholder="Next action" required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="nextActionAt" placeholder="Today 2:00 PM" required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="estimatedAssignmentFee" placeholder="Estimated fee" type="number" min="0" required />
                  <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="notes" placeholder="Notes" />
                  <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50 sm:col-span-2">Create Lead + Task</button>
                </form>
              </Card>
            </section>
          </section>

          <section className="mt-4">
            <Card id="opportunities" className="scroll-mt-32">
              <SectionTitle title="Top Opportunities" detail="Opportunity score is visible and explainable." />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-600">
                    <tr>
                      <th className="pb-3">Property</th>
                      <th className="pb-3">Score</th>
                      <th className="pb-3">Fee</th>
                      <th className="pb-3">Next</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    {realLeads.map((lead) => {
                      const property = leadProperties.get(lead.propertyId);
                      return (
                      <tr key={lead.id}>
                        <td className="py-3">
                          <p className="font-medium text-slate-900">{property?.address ?? "Unknown property"}</p>
                          <p className="text-xs text-slate-600">
                            {property?.city ?? "Unknown city"}, {property?.zipCode ?? "ZIP"}
                          </p>
                        </td>
                        <td className="py-3 font-mono text-slate-700">{lead.priority}</td>
                        <td className="py-3 font-mono text-blue-700">{money(lead.estimatedAssignmentFee)}</td>
                        <td className="py-3 text-slate-600">{lead.nextActionType}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section className="mt-4">
            <Card id="developers" className="scroll-mt-32">
              <SectionTitle title="Developers" detail="Buyer database, buy-box fit, purchase history, and pricing response tracking." />
              <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Add Developer</h3>
                  <form action={createDeveloperAction} className="grid gap-3 sm:grid-cols-2">
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="companyName" placeholder="Company name" required />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="contactName" placeholder="Contact name" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="email" placeholder="Email" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="phone" placeholder="Phone" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="targetZipCodes" placeholder="Target ZIPs, comma separated" required />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="maximumPurchasePrice" placeholder="Max purchase price" type="number" min="0" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="typicalBuildPrice" placeholder="Typical build price" type="number" min="0" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="website" placeholder="Website" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm sm:col-span-2" name="notes" placeholder="Notes" />
                    <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50 sm:col-span-2">Save Developer</button>
                  </form>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Record Developer Project</h3>
                  <form action={createDeveloperProjectAction} className="grid gap-3 sm:grid-cols-2">
                    <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm sm:col-span-2" name="developerId">
                      {db.developers.map((developer) => (
                        <option value={developer.id} key={developer.id}>{developer.companyName}</option>
                      ))}
                    </select>
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="address" placeholder="Project address" required />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="city" placeholder="City" required />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="state" placeholder="TX" maxLength={2} required />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="zipCode" placeholder="Zip code" required />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="originalPurchasePrice" placeholder="Original lot price" type="number" min="0" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="newBuildSalePrice" placeholder="New build sale price" type="number" min="0" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="lotSquareFeet" placeholder="Lot sqft" type="number" min="0" />
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="notes" placeholder="Notes" />
                    <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50 sm:col-span-2">Save Project</button>
                  </form>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Saved Developers</h3>
                  <div className="grid gap-3">
                    {db.developers.slice(0, 6).map((developer) => (
                  <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3" key={developer.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{developer.companyName}</p>
                        <p className="text-sm text-slate-600">{developer.contactName}</p>
                      </div>
                      <Badge tone={developer.active ? "good" : "neutral"}>{developer.active ? "Active" : "Inactive"}</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                      <span>Zip: {developer.targetZipCodes.join(", ")}</span>
                      <span>Max: {developer.maximumPurchasePrice ? money(developer.maximumPurchasePrice) : "Not set"}</span>
                      <span>Projects: {db.developerProjects.filter((project) => project.developerId === developer.id).length}</span>
                    </div>
                  </div>
                ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Developer Matches For {selectedMatchProperty?.address}</h3>
                  <form action={scoreDeveloperMatchesAction} className="mb-3 flex flex-wrap gap-2">
                    <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="propertyId" defaultValue={selectedMatchProperty?.id}>
                      {realProperties.map((property) => (
                        <option value={property.id} key={property.id}>{property.address}</option>
                      ))}
                    </select>
                    <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50">Score Matches</button>
                  </form>
                  <div className="grid gap-3">
                    {developerMatches.map((match) => {
                      const developer = developerById.get(match.developerId);
                      if (!developer || !selectedMatchProperty) return null;
                      return (
                        <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3" key={match.developerId}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">{developer.companyName}</p>
                              <p className="mt-1 text-xs text-slate-600">{match.reasons.join(" ")}</p>
                            </div>
                            <Badge tone={match.score >= 80 ? "good" : match.score >= 60 ? "warn" : "neutral"}>{match.score}/100</Badge>
                          </div>
                          <form action={generateDeveloperPricingRequestAction} className="mt-3">
                            <input type="hidden" name="propertyId" value={selectedMatchProperty.id} />
                            <input type="hidden" name="developerId" value={developer.id} />
                            <button className="rounded-md bg-blue-700 px-3 py-2 text-xs font-medium text-blue-50">Generate Pricing Request</button>
                          </form>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
            <Card id="properties" className="scroll-mt-32">
              <SectionTitle title="Properties" detail="Candidate properties with owners and active lead context in one workspace." />
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Candidate Properties</h3>
                  <div className="grid gap-2">
                    {realProperties.slice(0, 4).map((property) => (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-slate-200/70 px-3 py-2" key={property.id}>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{property.address}</p>
                          <p className="text-xs text-slate-600">{property.city} {property.zipCode}</p>
                        </div>
                        <span className="font-mono text-xs text-blue-700">{property.state}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Owners</h3>
                  <div className="grid gap-2">
                    {realProperties.slice(0, 4).map((property) => (
                      <div className="flex items-center justify-between gap-3 rounded-md border border-slate-300 bg-slate-200/70 px-3 py-2" key={`${property.id}-owner`}>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{property.ownerName}</p>
                          <p className="text-xs text-slate-600">{property.address}</p>
                        </div>
                        <Badge tone="neutral">Owner</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card id="leads" className="scroll-mt-32">
              <SectionTitle title="Leads" detail="Active acquisition opportunities by next required action." />
              <div className="grid gap-2">
                {realLeads.slice(0, 4).map((lead) => (
                  <div className="rounded-md border border-slate-300 bg-slate-200/70 px-3 py-2" key={`${lead.ownerName}-${lead.status}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-900">{lead.status.replaceAll("_", " ")}</p>
                      <span className="font-mono text-xs text-blue-700">{money(lead.estimatedAssignmentFee)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{lead.nextActionType}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="mt-4">
            <Card id="deals" className="scroll-mt-32">
              <SectionTitle title="Deals" detail="Reverse underwriting based on developer price minus seller price and costs." />
              <div className="rounded-md border border-slate-300 bg-slate-200/70 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Metric label="Conservative" value={money(82000)} />
                  <Metric label="Target" value={money(110000)} />
                  <Metric label="Aggressive" value={money(132000)} />
                </div>
                <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 font-mono text-sm text-blue-800">
                  {money(1900000)} - {money(1775000)} - {money(15000)} = {money(110000)}
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Estimates are planning numbers only. Contracts must use attorney-reviewed templates and state-specific review.
                </p>
              </div>
            </Card>
          </section>

          <section className="mt-4">
            <Card id="messages" className="scroll-mt-32">
              <SectionTitle title="Messages" detail="Templates, draft generation, approval queue, and disabled outbound provider handoff." />
              <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Template Manager</h3>
                  <form action={createMessageTemplateAction} className="grid gap-3">
                    <input className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="type" placeholder="Template name" required />
                    <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="channel" defaultValue="SMS">
                      <option>SMS</option>
                      <option>EMAIL</option>
                      <option>VOICE</option>
                      <option>INTERNAL</option>
                    </select>
                    <textarea className="min-h-28 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="body" placeholder="Use [OWNER], [PROPERTY], [ZIP] placeholders" required />
                    <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50">Save Template</button>
                  </form>
                </div>

                <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3">
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Generate Draft For Approval</h3>
                  <form action={generateDraftAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                    <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="templateId">
                      {db.messageTemplates.map((template) => (
                        <option value={template.id} key={template.id}>{template.type} ({template.channel})</option>
                      ))}
                    </select>
                    <select className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm" name="leadId">
                      {realLeads.map((lead) => (
                        <option value={lead.id} key={lead.id}>{lead.ownerName}</option>
                      ))}
                    </select>
                    <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50">Draft</button>
                  </form>
                </div>
              </div>

              <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Saved Templates</h3>
                  <div className="grid gap-3">
                    {db.messageTemplates.map((message) => (
                      <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3" key={message.id}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">{message.type}</h3>
                      <Badge tone="neutral">{message.channel}</Badge>
                    </div>
                    <p className="text-sm leading-6 text-slate-700">{message.body}</p>
                  </div>
                ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-900">Approval Queue</h3>
                  <div className="grid gap-3">
                    {db.messageApprovals.map((approval) => (
                      <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3" key={approval.id}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{approval.recipientLabel}</p>
                            <p className="text-xs text-slate-600">{approval.channel} · {approval.provider}</p>
                          </div>
                          <Badge tone={approval.status === "APPROVED" ? "good" : approval.status === "REJECTED" ? "danger" : "warn"}>{approval.status}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-700">{approval.body}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <form action={approveMessageAction}>
                            <input type="hidden" name="approvalId" value={approval.id} />
                            <button className="rounded-md bg-green-100 px-3 py-2 text-xs font-medium text-green-800">Approve</button>
                          </form>
                          <form action={rejectMessageAction}>
                            <input type="hidden" name="approvalId" value={approval.id} />
                            <button className="rounded-md bg-red-100 px-3 py-2 text-xs font-medium text-red-800">Reject</button>
                          </form>
                          <form action={blockedSendAttemptAction}>
                            <input type="hidden" name="approvalId" value={approval.id} />
                            <button className="rounded-md bg-yellow-100 px-3 py-2 text-xs font-medium text-yellow-800">Attempt Send</button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section id="pipeline" className="mt-4 scroll-mt-32">
            <Card>
              <SectionTitle title="Pipeline" detail="Supporting workflow view. Each move creates activity history, next task, and Best Action recalculation." />
              <div className="grid gap-3 overflow-x-auto xl:grid-cols-7">
                {statusColumns.map((status) => {
                  const columnLeads = realLeads.filter((lead) => lead.status === status);
                  return (
                    <div className="min-h-44 rounded-lg border border-slate-300 bg-slate-200/70 p-3" key={status}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold uppercase text-slate-600">{status.replaceAll("_", " ")}</h3>
                        <span className="font-mono text-xs text-slate-500">{columnLeads.length}</span>
                      </div>
                      <div className="grid gap-2">
                        {columnLeads.length ? (
                          columnLeads.map((lead) => (
                            <article className="rounded-md border border-slate-300 bg-slate-100 p-3" key={lead.id}>
                              <p className="text-sm font-medium text-slate-900">{leadProperties.get(lead.propertyId)?.address ?? "Unknown property"}</p>
                              <p className="mt-1 text-xs text-slate-600">{lead.ownerName}</p>
                              <div className="mt-3 flex items-center justify-between">
                                <Badge tone={lead.priority === "Urgent" ? "danger" : lead.priority === "High" ? "warn" : "neutral"}>
                                  {lead.priority}
                                </Badge>
                                <span className="font-mono text-xs text-blue-700">{money(lead.estimatedAssignmentFee)}</span>
                              </div>
                            </article>
                          ))
                        ) : (
                          <p className="rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-500">No leads here.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </section>

          <section className="mt-4">
            <Card id="research" className="scroll-mt-32">
              <SectionTitle title="Research" detail="Supporting notes for acquisition research. Core app data stays focused on properties, developers, deals, messages, and follow-up." />
              <div className="grid gap-3 md:grid-cols-3">
                {neighborhoods.map((area) => (
                  <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3" key={area.name}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{area.name}</p>
                        <p className="text-sm text-slate-600">{area.city} {area.zipCode}</p>
                      </div>
                      <Badge tone={area.opportunityScore >= 80 ? "good" : "neutral"}>{area.opportunityScore}/100</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-slate-600">
                      <span>{area.newBuildCount} known new builds</span>
                      <span>{money(area.averageNewBuildPrice)} avg new build</span>
                      <span>{area.developerActivityScore} developer activity</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <SectionTitle title="Seed Data Coverage" detail="Current MVP seed set aligned to the required workflow test." />
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                <span>{neighborhoods.length} neighborhoods</span>
                <span>{realProperties.length} candidate properties / owners</span>
                <span>{developers.length} developers</span>
                <span>{developerProjects.length} developer projects</span>
                <span>{realLeads.length} active leads</span>
                <span>3 pricing responses modeled</span>
                <span>2 offers modeled</span>
                <span>1 under-contract deal</span>
              </div>
            </Card>

            <Card id="settings" className="scroll-mt-32">
              <SectionTitle title="Settings" detail="Private MVP controls for mode, targets, scoring, providers, scheduler, and audit log." />
              <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <span>System mode: {info.systemMode}</span>
                <span>Minimum target fee: {money(50000)}</span>
                <span>Default inspection: 10 days</span>
                <span>Outbound automation: disabled</span>
                <span>Score weights: visible</span>
                <span>Migration version: {info.migrationVersion}</span>
                <span className="sm:col-span-2">Database: {info.path}</span>
                <span>SMS provider: {db.meta.smsProviderEnabled ? "enabled" : "disabled"}</span>
                <span>Email provider: {db.meta.emailProviderEnabled ? "enabled" : "disabled"}</span>
                <span>Voice provider: {db.meta.voiceProviderEnabled ? "enabled" : "disabled"}</span>
                <form action={runSchedulerAction}>
                  <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-blue-50">Run Follow-Up Scheduler</button>
                </form>
              </div>
            </Card>
          </section>

          <section className="mt-4">
            <Card>
              <SectionTitle title="Audit Log" detail="Every database change, approval action, webhook, scheduler run, and blocked outbound attempt is recorded here." />
              <div className="grid gap-2">
                {db.auditLogs.slice(0, 12).map((audit) => (
                  <div className="rounded-md border border-slate-300 bg-slate-200/70 px-3 py-2" key={audit.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{audit.summary}</p>
                      <span className="font-mono text-xs text-slate-500">{new Date(audit.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-blue-700">{audit.type}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-blue-800">{value}</p>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-300 bg-slate-200/70 p-3">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-blue-800">{value}</p>
    </div>
  );
}
