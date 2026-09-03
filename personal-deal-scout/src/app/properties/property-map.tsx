"use client";

import { useMemo } from "react";
import { US_STATE_CODES } from "@/lib/map-ranking";
import { OpenStreetPropertyMap } from "@/app/openstreet-maps";
import { GooglePropertyMap } from "@/app/properties/google-property-map";

export type MapProperty = {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string;
  neighborhood?: string;
  latitude?: number;
  longitude?: number;
  estimatedValue?: number;
};

export default function PropertyMap({
  properties,
  onSelect,
  baseColor,
  rankCategory,
}: {
  properties: MapProperty[];
  onSelect: (id: string) => void;
  baseColor: string;
  rankCategory: string;
}) {
  const mapped = useMemo(
    () =>
      properties.filter(
        (property) =>
          property.latitude !== undefined &&
          property.longitude !== undefined &&
          US_STATE_CODES.has(property.state.toUpperCase()) &&
          (property.latitude as number) >= 18 &&
          (property.latitude as number) <= 72 &&
          (property.longitude as number) >= -179 &&
          (property.longitude as number) <= -60,
      ),
    [properties],
  );

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">United States interactive listing map</h2>
            <p className="mt-1 text-xs text-slate-500">
              Pan, zoom, and select any sourced, geocoded property. Region
              filters update both map and list.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">
            {mapped.length} mapped
          </span>
        </div>
      </div>
      <div aria-label="Interactive map of sourced properties">
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_ENABLED === "true" &&
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
          <GooglePropertyMap
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
            baseColor={baseColor}
            onSelect={onSelect}
            properties={mapped}
            rankCategory={rankCategory}
          />
        ) : (
          <OpenStreetPropertyMap
            baseColor={baseColor}
            onSelect={onSelect}
            properties={mapped}
            rankCategory={rankCategory}
          />
        )}
      </div>
      {!mapped.length ? (
        <p className="border-t bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          No saved coordinates match these region filters. Automatic research
          will retry geocoding; unsupported addresses remain clearly marked for
          review.
        </p>
      ) : null}
    </div>
  );
}
