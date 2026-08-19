"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { FeatureCollection, Geometry } from "geojson";
import "leaflet/dist/leaflet.css";
import type { RadarMapListing, RadarMapSignal } from "@/app/research/development-radar-map-shell";
import { rankColor, US_MAP_BOUNDS, US_STATE_CODES } from "@/lib/map-ranking";
import { useThemeColor } from "@/lib/theme-color";

type BoundaryProperties = { GEOID?: string; BASENAME?: string };
type Boundaries = FeatureCollection<Geometry, BoundaryProperties>;
const TIGER_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer";

function boundaryUrl(layer: 24 | 25, geoids: string[]) {
  const params = new URLSearchParams({
    where: `GEOID IN (${geoids.map((geoid) => `'${geoid}'`).join(",")})`,
    outFields: "GEOID,BASENAME",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  return `${TIGER_SERVICE}/${layer}/query?${params}`;
}

async function fetchBoundaries(layer: 24 | 25, geoids: string[]) {
  if (!geoids.length) return null;
  const response = await fetch(boundaryUrl(layer, geoids));
  if (!response.ok) throw new Error(`Census boundary request failed with HTTP ${response.status}.`);
  return await response.json() as Boundaries;
}

const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Value unknown";

export default function DevelopmentRadarMap({ signals, listings, rankCategory }: { signals: RadarMapSignal[]; listings: RadarMapListing[]; rankCategory: string }) {
  const baseColor = useThemeColor();
  const [counties, setCounties] = useState<Boundaries | null>(null);
  const [states, setStates] = useState<Boundaries | null>(null);
  const [boundaryError, setBoundaryError] = useState("");
  const signalByFips = useMemo(() => new Map(signals.map((signal, index) => [signal.fips, { signal, index }])), [signals]);
  const stateRanks = useMemo(() => { const result = new Map<string, number>(); signals.forEach((signal, index) => { if (!result.has(signal.stateFips)) result.set(signal.stateFips, index); }); return result; }, [signals]);
  const mappedListings = listings.filter((listing) => US_STATE_CODES.has(listing.state.toUpperCase()) && listing.latitude >= 18 && listing.latitude <= 72 && listing.longitude >= -179 && listing.longitude <= -60);

  useEffect(() => {
    let active = true;
    Promise.all([fetchBoundaries(25, signals.map((signal) => signal.fips)), fetchBoundaries(24, [...new Set(signals.map((signal) => signal.stateFips))])]).then(([countyData, stateData]) => {
      if (active) { setCounties(countyData); setStates(stateData); setBoundaryError(""); }
    }).catch((error: unknown) => { if (active) setBoundaryError(error instanceof Error ? error.message : "Census boundaries are unavailable."); });
    return () => { active = false; };
  }, [signals]);

  return <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
    <div className="flex flex-col justify-between gap-4 border-b p-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">United States development and listing map</h2><p className="mt-1 text-sm text-slate-500">Official Census county and state boundaries correspond to the ranked radar. Exact listing markers show saved address, county, and neighborhood data.</p></div></div>
    <MapContainer center={[39, -98]} className="h-[560px] w-full" maxBounds={US_MAP_BOUNDS} maxBoundsViscosity={1} minZoom={3} scrollWheelZoom zoom={4}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Boundaries: U.S. Census Bureau' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {states ? <GeoJSON data={states} key={`states-${baseColor}-${rankCategory}`} onEachFeature={(feature, layer) => { const index = stateRanks.get(feature.properties?.GEOID ?? "") ?? signals.length - 1; layer.bindTooltip(`${feature.properties?.BASENAME ?? "State"} · best county #${index + 1} in ${rankCategory}`); }} style={(feature) => { const index = stateRanks.get(feature?.properties?.GEOID ?? "") ?? signals.length - 1; return { color: rankColor(baseColor, index, signals.length), fillColor: rankColor(baseColor, index, signals.length), fillOpacity: 0.08, weight: 3 }; }} /> : null}
      {counties ? <GeoJSON data={counties} key={`counties-${baseColor}-${rankCategory}`} onEachFeature={(feature, layer) => { const ranked = signalByFips.get(feature.properties?.GEOID ?? ""); if (ranked) layer.bindPopup(`<strong>#${ranked.index + 1} in ${rankCategory}</strong><br>${ranked.signal.countyName}, ${ranked.signal.stateName}<br>${ranked.signal.currentUnits.toLocaleString()} current units<br><strong>County sources:</strong> ${ranked.signal.countyCoverageStatus.replaceAll("_", " ")}<br>${ranked.signal.countyCoverageReason}`); }} style={(feature) => { const ranked = signalByFips.get(feature?.properties?.GEOID ?? ""); const index = ranked?.index ?? signals.length - 1; return { color: ranked?.signal.countyCoverageStatus === "AUTOMATED" ? "#166534" : ranked?.signal.countyCoverageStatus === "NEEDS_REVIEW" ? "#d97706" : "#64748b", fillColor: rankColor(baseColor, index, signals.length), fillOpacity: 0.62, weight: ranked ? 2 : 1 }; }} /> : null}
      {mappedListings.map((listing) => { const index = listing.marketFips ? signalByFips.get(listing.marketFips)?.index ?? signals.length - 1 : signals.length - 1; return <CircleMarker center={[listing.latitude, listing.longitude]} fillColor={rankColor(baseColor, index, signals.length)} fillOpacity={1} key={listing.id} pathOptions={{ color: "#0f172a", weight: 2 }} radius={9}><Popup><b>{listing.address}</b><br />{listing.city}, {listing.state} {listing.zipCode}<br />{listing.county || "County not saved"} · {listing.neighborhood || "Neighborhood not saved"}<br />{money(listing.estimatedValue)}{listing.marketFips && signalByFips.has(listing.marketFips) ? <><br /><b>#{index + 1} in {rankCategory}</b></> : null}</Popup></CircleMarker>; })}
    </MapContainer>
    <div className="flex flex-wrap gap-3 border-t p-4 text-xs"><span className="font-bold">{signals.length} ranked counties</span><span>·</span><span className="font-bold">{stateRanks.size} highlighted states</span><span>·</span><span className="font-bold">{mappedListings.length} exact listings</span>{boundaryError ? <span className="font-semibold text-red-700">· {boundaryError}</span> : null}</div>
  </section>;
}
