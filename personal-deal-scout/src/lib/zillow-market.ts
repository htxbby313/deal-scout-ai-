import { createHash } from "node:crypto";

export type ZillowDatasetManifestEntry = {
  key: string;
  name: string;
  definition: string;
  directUrl: string;
  fixture: string;
  fixtureHash: string;
  unit: string;
};

const catalog = "https://www.zillow.com/research/data/";
const common = {
  canonicalCatalogUrl: catalog,
  geography: "Metro",
  propertyType: "SFR/condo, all homes",
  frequency: "MONTHLY",
  identifierColumns: ["RegionID", "RegionName", "RegionType"],
  dateColumnPattern: "YYYY-MM-DD",
  expectedContentType: "text/csv",
  expectedMaximumBytes: 50 * 1024 * 1024,
  attributionNote: "Zillow Research aggregate market data; informational context only, not an appraisal or property-level fact.",
  reviewedBy: "owner-provided implementation handout",
  reviewedAt: "2026-08-21T00:00:00.000Z",
  enabled: false,
} as const;

export const approvedZillowDatasetManifest = [
  { key: "ZILLOW_METRO_ZHVI", name: "Zillow Home Value Index", definition: "Smoothed, seasonally adjusted market-value trend context.", directUrl: "https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv", fixture: "zhvi.csv", fixtureHash: "cf3168ba0ba4ba90c1473158f70162550a6dc2ccb0b2fa166a19f21f74b5d5da", unit: "USD_INDEX" },
  { key: "ZILLOW_METRO_INVENTORY", name: "For-Sale Inventory", definition: "Aggregate supply context.", directUrl: "https://files.zillowstatic.com/research/public_csvs/invt_fs/Metro_invt_fs_uc_sfrcondo_sm_month.csv", fixture: "inventory.csv", fixtureHash: "4a3e7770f1af75a043f6054830d0f1d2dc34ef57cbb35b794cd6cd72e87d4367", unit: "COUNT" },
  { key: "ZILLOW_METRO_SALES_COUNT", name: "Sales Count Nowcast", definition: "Aggregate sales volume adjusted for reporting latency.", directUrl: "https://files.zillowstatic.com/research/public_csvs/sales_count_now/Metro_sales_count_now_uc_sfrcondo_month.csv", fixture: "sales-count-nowcast.csv", fixtureHash: "9550bdd11b82ec3df669e7225acc3b19c2a5818eeb3cc3578c1efe2719661dec", unit: "COUNT" },
  { key: "ZILLOW_METRO_DAYS_TO_PENDING", name: "Mean Days to Pending", definition: "Aggregate market-speed observation.", directUrl: "https://files.zillowstatic.com/research/public_csvs/mean_doz_pending/Metro_mean_doz_pending_uc_sfrcondo_sm_month.csv", fixture: "days-to-pending.csv", fixtureHash: "cf29d27cdf5fa484a31e915beb2eb4031fc5426ce99c533da23f197902de1f89", unit: "DAYS" },
  { key: "ZILLOW_METRO_MARKET_HEAT", name: "Market Heat Index", definition: "Aggregate supply-demand context.", directUrl: "https://files.zillowstatic.com/research/public_csvs/market_temp_index/Metro_market_temp_index_uc_sfrcondo_month.csv", fixture: "market-heat.csv", fixtureHash: "f0c9207d08586ae99822353cd17d9bb56218e2d46b673bb5b0156e797706649c", unit: "INDEX" },
  { key: "ZILLOW_METRO_NEW_CONSTRUCTION_SALES", name: "New Construction Sales Count", definition: "Aggregate new-construction activity context.", directUrl: "https://files.zillowstatic.com/research/public_csvs/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv", fixture: "new-construction-sales.csv", fixtureHash: "8a950328fad428b44bd34a1c46655c561fcdf21ba626e2f9ed027ea430deedfe", unit: "COUNT" },
].map((entry) => ({ ...common, ...entry })) satisfies ReadonlyArray<ZillowDatasetManifestEntry & typeof common>;

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"' && quoted && csv[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (cell.length || row.length) { row.push(cell); if (row.some((value) => value.length)) rows.push(row); }
  return rows;
}

export function parseApprovedZillowCsv(input: { datasetKey: string; sourceUrl: string; contentType: string; body: string }) {
  const definition = approvedZillowDatasetManifest.find((item) => item.key === input.datasetKey);
  if (!definition) throw new Error("Dataset is not in the approved Zillow manifest.");
  if (input.sourceUrl !== definition.directUrl) throw new Error("Dataset URL does not match the approved manifest.");
  if (!input.contentType.toLowerCase().includes("text/csv")) throw new Error("Zillow dataset response is not CSV.");
  if (new TextEncoder().encode(input.body).byteLength > definition.expectedMaximumBytes) throw new Error("Zillow dataset exceeds its reviewed maximum size.");
  if (/^\s*</.test(input.body)) throw new Error("HTML and XML responses are quarantined.");
  const rows = parseCsvRows(input.body);
  const headers = rows.shift()?.map((header) => header.trim().replace(/^\uFEFF/, "")) ?? [];
  if (!definition.identifierColumns.every((column) => headers.includes(column))) throw new Error("Zillow dataset schema is missing required identifier columns.");
  const dateColumns = headers.filter((header) => /^\d{4}-\d{2}-\d{2}$/.test(header));
  if (!dateColumns.length) throw new Error("Zillow dataset has no recognized observation dates.");
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const observations = rows.flatMap((row) => dateColumns.flatMap((period) => {
    const raw = row[headerIndex.get(period)!]?.trim();
    if (!raw) return [];
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Invalid numeric observation for ${period}.`);
    return [{ geographyType: row[headerIndex.get("RegionType")!] || "UNKNOWN", regionId: row[headerIndex.get("RegionID")!], regionName: row[headerIndex.get("RegionName")!], period: new Date(`${period}T00:00:00.000Z`), value: raw, unit: definition.unit }];
  }));
  if (!observations.length) throw new Error("Zillow dataset contains no numeric observations.");
  return { definition, contentHash: createHash("sha256").update(input.body).digest("hex"), headers, rowCount: rows.length, observations };
}
