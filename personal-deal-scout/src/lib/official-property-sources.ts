import "server-only";
import { z } from "zod";
import { fetchValidatedJson, normalizeText } from "@/lib/research-runtime";

export type OfficialPropertyFinding = {
  topic: string;
  label: string;
  value: string;
  status: "VERIFIED";
  sourceName: string;
  sourceUrl: string;
  confidence: number;
  notes: string;
};

type PropertyIdentity = {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string | null;
  latitude: number;
  longitude: number;
};

const arcGisResponseSchema = z.object({ features: z.array(z.object({ attributes: z.record(z.string(), z.unknown()).optional() })).optional(), error: z.object({ message: z.string().optional() }).optional() });

const BEXAR_PARCELS = "https://maps.bexar.org/arcgis/rest/services/Parcels/MapServer/0/query";
const SAN_ANTONIO_ADDRESSES = "https://qagis.sanantonio.gov/arcgis/rest/services/311/311_OneView/MapServer/0/query";
const SAN_ANTONIO_PARCELS = "https://qagis.sanantonio.gov/arcgis/rest/services/311/311_OneView/MapServer/2/query";
const FEMA_FLOOD_ZONES = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

type OfficialAdapter = { id: string; scope: "US" | "COUNTY" | "CITY"; state?: string; county?: string; city?: string; topics: string[] };

const OFFICIAL_ADAPTERS: OfficialAdapter[] = [
  { id: "fema-nfhl", scope: "US", topics: ["FLOOD"] },
  { id: "bexar-parcels", scope: "COUNTY", state: "TX", county: "bexar", topics: ["OWNERSHIP", "PARCEL", "TAX", "DIMENSIONS", "ZONING"] },
  { id: "san-antonio-addresses", scope: "CITY", state: "TX", city: "san antonio", topics: ["HISTORIC", "UTILITIES"] },
  { id: "san-antonio-parcels", scope: "CITY", state: "TX", city: "san antonio", topics: ["ZONING"] },
];

function applicableAdapters(property: Pick<PropertyIdentity, "state" | "county" | "city">) {
  const state = property.state.trim().toLowerCase();
  const county = property.county?.trim().toLowerCase().replace(/\s+county$/, "") || "";
  const city = property.city.trim().toLowerCase();
  return OFFICIAL_ADAPTERS.filter((adapter) => adapter.scope === "US" || (adapter.state?.toLowerCase() === state && (adapter.scope === "COUNTY" ? county === adapter.county : city === adapter.city)));
}

function text(value: unknown) {
  return normalizeText(value);
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function dollars(value: unknown) {
  const parsed = number(value);
  return parsed === undefined ? "Not reported" : parsed.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function addressSearch(address: string) {
  const tokens = address.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const numberToken = tokens.find((token) => /^\d+[A-Z]?$/.test(token));
  const streetToken = tokens.find((token) => token !== numberToken && token.length > 2 && !["STREET", "ROAD", "AVENUE", "DRIVE", "LANE", "COURT", "BLVD"].includes(token));
  if (!numberToken || !streetToken) throw new Error("The property address cannot be searched in official county records.");
  return `${numberToken}%${streetToken}`;
}

function queryUrl(base: string, params: Record<string, string>) {
  const url = new URL(base);
  url.search = new URLSearchParams({ ...params, f: "json" }).toString();
  return url;
}

async function arcGis(url: URL) {
  const payload = await fetchValidatedJson(url, arcGisResponseSchema, { cache: "no-store", attempts: 3, timeoutMs: 15_000, headers: { "User-Agent": "DealScoutAI/1.0 official-public-record-research" } });
  if (payload.error) throw new Error(payload.error.message || "Official ArcGIS query failed.");
  return payload.features?.[0]?.attributes;
}

export function bexarParcelFindings(attributes: Record<string, unknown>, sourceUrl: string): OfficialPropertyFinding[] {
  const owner = text(attributes.Owner);
  const parcelId = text(attributes.PropID);
  const account = text(attributes.AcctNumb);
  const legal = text(attributes.LglDesc);
  const acreage = number(attributes.Acres) ?? number(attributes.LglAcres);
  const assessed = number(attributes.TotVal);
  const land = number(attributes.LandVal);
  const improvements = number(attributes.ImprVal);
  const yearBuilt = text(attributes.YrBlt);
  const useCode = text(attributes.PropUse);
  const findings: OfficialPropertyFinding[] = [];
  if (owner) findings.push({ topic: "OWNERSHIP", label: "Recorded ownership", value: owner, status: "VERIFIED", sourceName: "Bexar County GIS / BCAD", sourceUrl, confidence: 90, notes: "Public appraisal ownership record; title and current conveyances still require a title professional." });
  if (parcelId || account || legal) findings.push({ topic: "PARCEL", label: "Parcel identity and legal description", value: [`Parcel ${parcelId}`, account && `Account ${account}`, legal].filter(Boolean).join(" · "), status: "VERIFIED", sourceName: "Bexar County GIS / BCAD", sourceUrl, confidence: 95, notes: "Official county parcel record matched by situs address." });
  if (assessed !== undefined || land !== undefined || improvements !== undefined) findings.push({ topic: "TAX", label: "Tax and assessed value", value: `Total ${dollars(assessed)} · land ${dollars(land)} · improvements ${dollars(improvements)}`, status: "VERIFIED", sourceName: "Bexar County GIS / BCAD", sourceUrl, confidence: 90, notes: "Appraisal values are not an asking price or market-value guarantee." });
  if (acreage !== undefined) findings.push({ topic: "DIMENSIONS", label: "Lot dimensions and frontage", value: `${acreage.toLocaleString("en-US", { maximumFractionDigits: 4 })} acres (${Math.round(acreage * 43_560).toLocaleString("en-US")} sq ft); frontage is not reported`, status: "VERIFIED", sourceName: "Bexar County GIS / BCAD", sourceUrl, confidence: 85, notes: "County acreage is verified; frontage requires survey or parcel geometry measurement." });
  if (useCode || yearBuilt) findings.push({ topic: "ZONING", label: "Zoning and permitted use", value: [`Appraisal use code ${useCode || "not reported"}`, yearBuilt && `year built ${yearBuilt}`].filter(Boolean).join(" · "), status: "VERIFIED", sourceName: "Bexar County GIS / BCAD", sourceUrl, confidence: 65, notes: "This verifies the appraisal use code only. It is not a legal zoning determination." });
  return findings;
}

export function sanAntonioAddressFindings(attributes: Record<string, unknown>, sourceUrl: string): OfficialPropertyFinding[] {
  const neighborhood = text(attributes.NeighborhoodName);
  const historicDistrict = text(attributes.HistoricDistrict);
  const landmark = text(attributes.HistoricLandmarkSites);
  const service = [text(attributes.Fire), text(attributes.EMS), text(attributes.GarbageServices)].filter(Boolean);
  return [
    { topic: "HISTORIC", label: "Historic or demolition restriction indicators", value: historicDistrict || landmark ? `Historic district: ${historicDistrict || "not listed"} · landmark indicator: ${landmark || "not listed"}` : "No historic district or landmark indicator appears in the city address record", status: "VERIFIED", sourceName: "City of San Antonio GIS", sourceUrl, confidence: 80, notes: "City GIS screening result; project-specific demolition approval still requires city confirmation." },
    ...(service.length ? [{ topic: "UTILITIES", label: "Utility availability", value: `Recorded city services: ${service.join(" · ")}${neighborhood ? ` · neighborhood ${neighborhood}` : ""}`, status: "VERIFIED" as const, sourceName: "City of San Antonio GIS", sourceUrl, confidence: 75, notes: "Service-area evidence does not prove active private utility accounts or capacity." }] : []),
  ];
}

export function sanAntonioParcelFindings(attributes: Record<string, unknown>, sourceUrl: string): OfficialPropertyFinding[] {
  const overlay = text(attributes.ZoningOverlay);
  if (!overlay) return [];
  return [{ topic: "ZONING", label: "Zoning and permitted use", value: `City parcel zoning overlay: ${overlay}`, status: "VERIFIED", sourceName: "City of San Antonio GIS", sourceUrl, confidence: 80, notes: "Official city GIS overlay screening; base zoning, permitted use, and project approval still require city confirmation." }];
}

export function femaFloodFinding(attributes: Record<string, unknown>, sourceUrl: string): OfficialPropertyFinding {
  const zone = text(attributes.FLD_ZONE) || "Not reported";
  const subtype = text(attributes.ZONE_SUBTY) || "No subtype reported";
  const sfha = text(attributes.SFHA_TF);
  return { topic: "FLOOD", label: "Flood hazard", value: `FEMA zone ${zone} · ${subtype} · special flood hazard area: ${sfha === "T" ? "yes" : sfha === "F" ? "no" : "not reported"}`, status: "VERIFIED", sourceName: "FEMA National Flood Hazard Layer", sourceUrl, confidence: 90, notes: "Coordinate-based FEMA screening; a lender or surveyor may require a formal flood determination." };
}

export async function researchOfficialPropertySources(property: PropertyIdentity) {
  const findings: OfficialPropertyFinding[] = [];
  const errors: string[] = [];
  let sourcesChecked = 0;

  const floodUrl = queryUrl(FEMA_FLOOD_ZONES, { geometry: `${property.longitude},${property.latitude}`, geometryType: "esriGeometryPoint", inSR: "4326", spatialRel: "esriSpatialRelIntersects", outFields: "FLD_ZONE,ZONE_SUBTY,SFHA_TF,SOURCE_CIT", returnGeometry: "false" });
  sourcesChecked += 1;
  try {
    const flood = await arcGis(floodUrl);
    if (flood) findings.push(femaFloodFinding(flood, floodUrl.toString()));
  } catch (error) { errors.push(`FEMA NFHL: ${error instanceof Error ? error.message : "lookup failed"}`); }

  const adapters = new Set(applicableAdapters(property).map((adapter) => adapter.id));
  const isBexar = adapters.has("bexar-parcels") || property.city.toLowerCase() === "san antonio";
  if (isBexar) {
    const search = addressSearch(property.address);
    const parcelUrl = queryUrl(BEXAR_PARCELS, { where: `UPPER(SITUS) LIKE '${search}'`, outFields: "PropID,Situs,Owner,AcctNumb,LglDesc,LandVal,ImprVal,TotVal,YrBlt,LglAcres,Acres,PropUse", returnGeometry: "false" });
    sourcesChecked += 1;
    try {
      const parcel = await arcGis(parcelUrl);
      if (parcel) findings.push(...bexarParcelFindings(parcel, parcelUrl.toString()));
    } catch (error) { errors.push(`Bexar County parcel GIS: ${error instanceof Error ? error.message : "lookup failed"}`); }

    const addressUrl = queryUrl(SAN_ANTONIO_ADDRESSES, { where: `UPPER(Situs) LIKE '${search}'`, outFields: "Situs,Status,NeighborhoodName,HistoricDistrict,HistoricLandmarkSites,Fire,EMS,GarbageServices", returnGeometry: "false" });
    sourcesChecked += 1;
    try {
      const address = await arcGis(addressUrl);
      if (address) findings.push(...sanAntonioAddressFindings(address, addressUrl.toString()));
    } catch (error) { errors.push(`City of San Antonio GIS: ${error instanceof Error ? error.message : "lookup failed"}`); }

    const cityParcelUrl = queryUrl(SAN_ANTONIO_PARCELS, { where: `UPPER(BCADSitusAddress) LIKE '${search}%'`, outFields: "BCADParcelID,BCADSitusAddress,ZoningOverlay,ETJ", returnGeometry: "false" });
    sourcesChecked += 1;
    try {
      const cityParcel = await arcGis(cityParcelUrl);
      if (cityParcel) findings.push(...sanAntonioParcelFindings(cityParcel, cityParcelUrl.toString()));
    } catch (error) { errors.push(`City of San Antonio parcel GIS: ${error instanceof Error ? error.message : "lookup failed"}`); }
  }

  return { findings, errors, sourcesChecked };
}

export const __officialPropertySourceTestables = { addressSearch, applicableAdapters, arcGisResponseSchema, bexarParcelFindings, sanAntonioAddressFindings, sanAntonioParcelFindings, femaFloodFinding };
