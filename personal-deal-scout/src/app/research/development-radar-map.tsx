"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { RadarMapListing, RadarMapSignal } from "@/app/research/development-radar-map-shell";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { rankColor, US_STATE_CODES } from "@/lib/map-ranking";
import { useThemeColor } from "@/lib/theme-color";
import { OpenStreetDevelopmentMap } from "@/app/openstreet-maps";

type BoundaryProperties = { GEOID?: string; BASENAME?: string };
type Boundaries = FeatureCollection<Geometry, BoundaryProperties>;
const TIGER_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer";

function boundaryUrl(layer: 24 | 25, geoids: string[]) {
  const params = new URLSearchParams({ where: `GEOID IN (${geoids.map((geoid) => `'${geoid}'`).join(",")})`, outFields: "GEOID,BASENAME", returnGeometry: "true", outSR: "4326", f: "geojson" });
  return `${TIGER_SERVICE}/${layer}/query?${params}`;
}

async function fetchBoundaries(layer: 24 | 25, geoids: string[]) {
  if (!geoids.length) return null;
  const response = await fetch(boundaryUrl(layer, geoids));
  if (!response.ok) throw new Error(`Census boundary request failed with HTTP ${response.status}.`);
  return await response.json() as Boundaries;
}

const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Value unknown";

function infoContent(lines: Array<{ label?: string; value: string }>) {
  const container = document.createElement("div");
  lines.forEach(({ label, value }) => {
    const row = document.createElement("p");
    if (label) { const strong = document.createElement("strong"); strong.textContent = `${label}: `; row.append(strong); }
    row.append(document.createTextNode(value));
    container.append(row);
  });
  return container;
}

export default function DevelopmentRadarMap({ signals, listings, rankCategory }: { signals: RadarMapSignal[]; listings: RadarMapListing[]; rankCategory: string }) {
  const baseColor = useThemeColor();
  const mapNode = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");
  const [fallbackBoundaries, setFallbackBoundaries] = useState<Boundaries | null>(null);
  const googleMapsEnabled = process.env.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED === "true";
  const apiKey = googleMapsEnabled ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "" : "";
  const signalByFips = useMemo(() => new Map(signals.map((signal, index) => [signal.fips, { signal, index }])), [signals]);
  const stateRanks = useMemo(() => { const result = new Map<string, number>(); signals.forEach((signal, index) => { if (!result.has(signal.stateFips)) result.set(signal.stateFips, index); }); return result; }, [signals]);
  const mappedListings = useMemo(() => listings.filter((listing) => US_STATE_CODES.has(listing.state.toUpperCase()) && listing.latitude >= 18 && listing.latitude <= 72 && listing.longitude >= -179 && listing.longitude <= -60), [listings]);

  useEffect(() => {
    if (apiKey || !signals.length) return;
    let disposed = false;
    Promise.all([fetchBoundaries(25, signals.map((signal) => signal.fips)), fetchBoundaries(24, [...new Set(signals.map((signal) => signal.stateFips))])]).then(([counties, states]) => {
      if (!disposed) setFallbackBoundaries({ type: "FeatureCollection", features: [...(states?.features ?? []), ...(counties?.features ?? [])] });
    }).catch((error: unknown) => { if (!disposed) setMapError(error instanceof Error ? error.message : "Census boundaries are unavailable."); });
    return () => { disposed = true; };
  }, [apiKey, signals]);

  useEffect(() => {
    if (!apiKey || !mapNode.current) return;
    const node = mapNode.current;
    let disposed = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const markers: google.maps.Marker[] = [];

    Promise.all([
      loadGoogleMaps(apiKey),
      fetchBoundaries(25, signals.map((signal) => signal.fips)),
      fetchBoundaries(24, [...new Set(signals.map((signal) => signal.stateFips))]),
    ]).then(([maps, counties, states]) => {
      if (disposed) return;
      const map = new maps.Map(node, { center: { lat: 39, lng: -98 }, zoom: 4, minZoom: 3, restriction: { latLngBounds: { north: 72, south: 18, west: -179, east: -60 }, strictBounds: false }, mapTypeControl: false, streetViewControl: false });
      const info = new maps.InfoWindow();
      if (states) map.data.addGeoJson(states, { idPropertyName: "GEOID" });
      if (counties) map.data.addGeoJson(counties, { idPropertyName: "GEOID" });
      map.data.setStyle((feature) => {
        const fips = String(feature.getProperty("GEOID") ?? "");
        const ranked = signalByFips.get(fips);
        const stateIndex = stateRanks.get(fips);
        if (ranked) return { strokeColor: ranked.signal.countyCoverageStatus === "AUTOMATED" ? "#166534" : ranked.signal.countyCoverageStatus === "NEEDS_REVIEW" ? "#d97706" : "#64748b", strokeWeight: 2, fillColor: rankColor(baseColor, ranked.index, signals.length), fillOpacity: 0.62 };
        const index = stateIndex ?? signals.length - 1;
        return { strokeColor: rankColor(baseColor, index, signals.length), strokeWeight: 3, fillColor: rankColor(baseColor, index, signals.length), fillOpacity: 0.08 };
      });
      listeners.push(map.data.addListener("click", (event: google.maps.Data.MouseEvent) => {
        const fips = String(event.feature.getProperty("GEOID") ?? "");
        const ranked = signalByFips.get(fips);
        if (!ranked) return;
        info.setContent(infoContent([
          { value: `#${ranked.index + 1} in ${rankCategory}` },
          { value: `${ranked.signal.countyName}, ${ranked.signal.stateName}` },
          { label: "Current units", value: ranked.signal.currentUnits.toLocaleString() },
          { label: "County sources", value: ranked.signal.countyCoverageStatus.replaceAll("_", " ") },
          { value: ranked.signal.countyCoverageReason },
        ]));
        info.setPosition(event.latLng);
        info.open({ map });
      }));
      mappedListings.forEach((listing) => {
        const index = listing.marketFips ? signalByFips.get(listing.marketFips)?.index ?? signals.length - 1 : signals.length - 1;
        const marker = new maps.Marker({ map, position: { lat: listing.latitude, lng: listing.longitude }, title: listing.address, icon: { path: maps.SymbolPath.CIRCLE, fillColor: rankColor(baseColor, index, signals.length), fillOpacity: 1, strokeColor: "#0f172a", strokeWeight: 2, scale: 9 } });
        markers.push(marker);
        listeners.push(marker.addListener("click", () => {
          info.setContent(infoContent([{ value: listing.address }, { value: `${listing.city}, ${listing.state} ${listing.zipCode}` }, { value: `${listing.county || "County not saved"} · ${listing.neighborhood || "Neighborhood not saved"}` }, { value: money(listing.estimatedValue) }, ...(listing.marketFips && signalByFips.has(listing.marketFips) ? [{ value: `#${index + 1} in ${rankCategory}` }] : [])]));
          info.open({ map, anchor: marker });
        }));
      });
      const updateListingVisibility = () => {
        const visible = (map.getZoom() ?? 4) >= 6;
        markers.forEach((marker) => marker.setVisible(visible));
      };
      updateListingVisibility();
      listeners.push(map.addListener("zoom_changed", updateListingVisibility));
      setMapError("");
    }).catch((error: unknown) => { if (!disposed) setMapError(error instanceof Error ? error.message : "The development map is unavailable."); });

    return () => { disposed = true; listeners.forEach((listener) => listener.remove()); markers.forEach((marker) => marker.setMap(null)); };
  }, [apiKey, baseColor, mappedListings, rankCategory, signalByFips, signals, stateRanks]);

  return <section className="map-card mt-6 rounded-2xl border bg-white shadow-sm">
    <div className="flex flex-col justify-between gap-4 border-b p-5 sm:flex-row sm:items-center"><div><h2 className="text-xl font-bold">United States development and listing map</h2><p className="mt-1 text-sm text-slate-500">Official Census county and state boundaries correspond to the ranked radar. Exact listing markers show saved address, county, and neighborhood data.</p></div></div>
    {apiKey ? <div aria-label="Google map of development signals and listings" className="map-viewport h-[560px]" ref={mapNode} /> : <div aria-label="OpenStreetMap of development signals and listings" className="map-viewport h-[560px]"><OpenStreetDevelopmentMap baseColor={baseColor} boundaries={fallbackBoundaries} listings={mappedListings} rankCategory={rankCategory} signals={signals} /></div>}
    <div className="flex flex-wrap gap-3 border-t p-4 text-xs"><span className="font-bold">{signals.length} ranked counties</span><span>·</span><span className="font-bold">{stateRanks.size} highlighted states</span><span>·</span><span className="font-bold">{mappedListings.length} exact listings appear as you zoom in</span>{mapError ? <span className="font-semibold text-red-700">· {mapError}</span> : null}</div>
  </section>;
}
