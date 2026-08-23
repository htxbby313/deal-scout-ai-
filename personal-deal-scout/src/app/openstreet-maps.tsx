"use client";

import { useEffect } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { MapProperty } from "@/app/properties/property-map";
import type { RadarMapListing, RadarMapSignal } from "@/app/research/development-radar-map-shell";
import { rankColor } from "@/lib/map-ranking";

const US_BOUNDS: [[number, number], [number, number]] = [[18, -179], [72, -60]];
type BoundaryProperties = { GEOID?: string; BASENAME?: string };
type Boundaries = FeatureCollection<Geometry, BoundaryProperties>;

function FitPoints({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => { if (points.length === 1) map.setView(points[0], 14); else if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 13 }); }, [map, points]);
  return null;
}

const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Value unknown";

export function OpenStreetPropertyMap({ properties, onSelect, baseColor, rankCategory }: { properties: MapProperty[]; onSelect: (id: string) => void; baseColor: string; rankCategory: string }) {
  const points = properties.map((property) => [property.latitude!, property.longitude!] as [number, number]);
  return <MapContainer bounds={US_BOUNDS} className="h-[430px] w-full" maxBounds={US_BOUNDS} minZoom={3} scrollWheelZoom>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <FitPoints points={points} />
    {properties.map((property, index) => <CircleMarker center={[property.latitude!, property.longitude!]} fillColor={rankColor(baseColor, index, properties.length)} fillOpacity={1} key={property.id} pathOptions={{ color: "#0f172a", weight: 2 }} radius={9}><Popup><b>#{index + 1} in {rankCategory}</b><br />{property.address}<br />{property.city}, {property.state} {property.zipCode}<br />{money(property.estimatedValue)}<br /><button className="mt-2 font-bold text-blue-700" onClick={() => onSelect(property.id)}>Open property</button></Popup></CircleMarker>)}
  </MapContainer>;
}

export function OpenStreetDevelopmentMap({ boundaries, signals, listings, baseColor, rankCategory }: { boundaries: Boundaries | null; signals: RadarMapSignal[]; listings: RadarMapListing[]; baseColor: string; rankCategory: string }) {
  const signalByFips = new Map(signals.map((signal, index) => [signal.fips, { signal, index }]));
  const style = (feature?: Feature<Geometry, BoundaryProperties>) => {
    const ranked = signalByFips.get(String(feature?.properties?.GEOID ?? ""));
    return { color: ranked?.signal.countyCoverageStatus === "AUTOMATED" ? "#166534" : ranked?.signal.countyCoverageStatus === "NEEDS_REVIEW" ? "#d97706" : "#64748b", weight: 2, fillColor: ranked ? rankColor(baseColor, ranked.index, signals.length) : baseColor, fillOpacity: ranked ? 0.58 : 0.08 };
  };
  return <MapContainer bounds={US_BOUNDS} className="h-[560px] w-full" maxBounds={US_BOUNDS} minZoom={3} scrollWheelZoom>
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    {boundaries ? <GeoJSON data={boundaries} key={signals.map((signal) => signal.fips).join("-")} onEachFeature={(feature, layer) => { const ranked = signalByFips.get(String(feature.properties?.GEOID ?? "")); if (ranked) layer.bindPopup(`<strong>#${ranked.index + 1} in ${rankCategory}</strong><br>${ranked.signal.countyName}, ${ranked.signal.stateName}<br>${ranked.signal.currentUnits.toLocaleString()} current units<br>${ranked.signal.countyCoverageStatus.replaceAll("_", " ")}`); }} style={style} /> : null}
    {listings.map((listing, index) => <CircleMarker center={[listing.latitude, listing.longitude]} fillColor={rankColor(baseColor, index, listings.length)} fillOpacity={1} key={listing.id} pathOptions={{ color: "#0f172a", weight: 2 }} radius={8}><Popup><b>{listing.address}</b><br />{listing.city}, {listing.state} {listing.zipCode}<br />{money(listing.estimatedValue)}</Popup></CircleMarker>)}
  </MapContainer>;
}
