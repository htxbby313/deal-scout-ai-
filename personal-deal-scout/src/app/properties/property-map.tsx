"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapProperty = { id: string; address: string; city: string; state: string; zipCode: string; county?: string; neighborhood?: string; latitude?: number; longitude?: number; estimatedValue?: number };

function FitListings({ properties }: { properties: MapProperty[] }) {
  const map = useMap();
  const coordinates = properties.filter((property) => property.latitude !== undefined && property.longitude !== undefined).map((property) => [property.latitude as number, property.longitude as number] as [number, number]);
  useEffect(() => {
    if (coordinates.length === 1) map.setView(coordinates[0], 14);
    else if (coordinates.length > 1) map.fitBounds(coordinates as LatLngBoundsExpression, { padding: [30, 30], maxZoom: 13 });
  }, [coordinates, map]);
  return null;
}

const money = (value?: number) => value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value) : "Value unknown";

export default function PropertyMap({ properties, onSelect }: { properties: MapProperty[]; onSelect: (id: string) => void }) {
  const mapped = properties.filter((property) => property.latitude !== undefined && property.longitude !== undefined);
  return <div className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Interactive listing map</h2><p className="mt-1 text-xs text-slate-500">Pan, zoom, and select a sourced listing. Region filters update both map and list.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{mapped.length} mapped</span></div></div>
    <MapContainer center={[37.8, -96]} className="h-[430px] w-full" scrollWheelZoom zoom={4}><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FitListings properties={mapped} />{mapped.map((property) => <CircleMarker center={[property.latitude as number, property.longitude as number]} eventHandlers={{ click: () => onSelect(property.id) }} fillColor="#1d4ed8" fillOpacity={0.85} key={property.id} pathOptions={{ color: "#ffffff", weight: 2 }} radius={10}><Popup><b>{property.address}</b><br />{property.city}, {property.state} {property.zipCode}<br />{money(property.estimatedValue)}<br /><button className="mt-2 font-bold text-blue-700" onClick={() => onSelect(property.id)}>Open dossier</button></Popup></CircleMarker>)}</MapContainer>
    {!mapped.length ? <p className="border-t bg-amber-50 p-3 text-xs font-semibold text-amber-900">No coordinates in this region yet. Run property research; failed geocodes are routed to manual verification.</p> : null}
  </div>;
}
