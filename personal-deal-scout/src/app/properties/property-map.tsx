"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { rankColor, US_STATE_CODES } from "@/lib/map-ranking";
import { OpenStreetPropertyMap } from "@/app/openstreet-maps";

export type MapProperty = { id: string; address: string; city: string; state: string; zipCode: string; county?: string; neighborhood?: string; latitude?: number; longitude?: number; estimatedValue?: number };

const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Value unknown";

function popupHtml(property: MapProperty, rank: number, rankCategory: string) {
  const container = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = `#${rank} in ${rankCategory}`;
  const address = document.createElement("p");
  address.textContent = `${property.address} · ${property.city}, ${property.state} ${property.zipCode}`;
  const region = document.createElement("p");
  region.textContent = `${property.county || "County not saved"} · ${property.neighborhood || "Neighborhood not saved"}`;
  const value = document.createElement("p");
  value.textContent = money(property.estimatedValue);
  const button = document.createElement("button");
  button.className = "mt-2 font-bold text-blue-700";
  button.textContent = "Open property";
  container.append(title, address, region, value, button);
  return { button, container };
}

export default function PropertyMap({ properties, onSelect, baseColor, rankCategory }: { properties: MapProperty[]; onSelect: (id: string) => void; baseColor: string; rankCategory: string }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const mapped = useMemo(() => properties.filter((property) => property.latitude !== undefined && property.longitude !== undefined && US_STATE_CODES.has(property.state.toUpperCase()) && (property.latitude as number) >= 18 && (property.latitude as number) <= 72 && (property.longitude as number) >= -179 && (property.longitude as number) <= -60), [properties]);

  useEffect(() => {
    if (!apiKey || !mapNode.current) return;
    const node = mapNode.current;
    let disposed = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const markers: google.maps.Marker[] = [];

    loadGoogleMaps(apiKey).then((maps) => {
      if (disposed) return;
      const map = new maps.Map(node, { center: { lat: 39, lng: -98 }, zoom: 4, minZoom: 3, restriction: { latLngBounds: { north: 72, south: 18, west: -179, east: -60 }, strictBounds: false }, mapTypeControl: false, streetViewControl: false });
      const bounds = new maps.LatLngBounds();
      const info = new maps.InfoWindow();
      mapped.forEach((property) => {
        const rankIndex = properties.findIndex((candidate) => candidate.id === property.id);
        const position = { lat: property.latitude as number, lng: property.longitude as number };
        bounds.extend(position);
        const marker = new maps.Marker({ map, position, title: property.address, icon: { path: maps.SymbolPath.CIRCLE, fillColor: rankColor(baseColor, rankIndex, properties.length), fillOpacity: 1, strokeColor: "#0f172a", strokeWeight: 2, scale: 9 } });
        markers.push(marker);
        listeners.push(marker.addListener("click", () => {
          const { button, container } = popupHtml(property, rankIndex + 1, rankCategory);
          button.addEventListener("click", () => onSelect(property.id), { once: true });
          info.setContent(container);
          info.open({ map, anchor: marker });
        }));
      });
      if (mapped.length === 1) { map.setCenter(bounds.getCenter()); map.setZoom(14); }
      else if (mapped.length > 1) map.fitBounds(bounds, 30);
      setMapError("");
    }).catch((error: unknown) => { if (!disposed) setMapError(error instanceof Error ? error.message : "Google Maps is unavailable."); });

    return () => { disposed = true; listeners.forEach((listener) => listener.remove()); markers.forEach((marker) => marker.setMap(null)); };
  }, [apiKey, baseColor, mapped, onSelect, properties, rankCategory]);

  return <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">United States interactive listing map</h2><p className="mt-1 text-xs text-slate-500">Pan, zoom, and select any sourced, geocoded property. Region filters update both map and list.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{mapped.length} mapped</span></div></div>
    {apiKey ? <div aria-label="Google map of sourced properties" className="h-[430px] w-full" ref={mapNode} /> : <div aria-label="OpenStreetMap of sourced properties"><OpenStreetPropertyMap baseColor={baseColor} onSelect={onSelect} properties={mapped} rankCategory={rankCategory} /></div>}
    {mapError ? <p className="border-t bg-red-50 p-3 text-xs font-semibold text-red-800">{mapError}</p> : null}
    {!mapped.length ? <p className="border-t bg-amber-50 p-3 text-xs font-semibold text-amber-900">No saved coordinates match these region filters. Automatic research will retry geocoding; unsupported addresses remain clearly marked for review.</p> : null}
  </div>;
}
