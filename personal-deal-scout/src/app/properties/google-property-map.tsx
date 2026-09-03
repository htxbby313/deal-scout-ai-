"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-loader";
import { rankColor } from "@/lib/map-ranking";
import type { MapProperty } from "@/app/properties/property-map";

const money = (value?: number) =>
  value
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value)
    : "Value unknown";

export function GooglePropertyMap({
  properties,
  onSelect,
  baseColor,
  rankCategory,
  apiKey,
}: {
  properties: MapProperty[];
  onSelect: (id: string) => void;
  baseColor: string;
  rankCategory: string;
  apiKey: string;
}) {
  const node = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!apiKey || !node.current) return;
    const mapNode = node.current;
    let disposed = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const markers: google.maps.Marker[] = [];

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (disposed) return;
        const map = new maps.Map(mapNode, {
          center: { lat: 39, lng: -98 },
          zoom: 4,
          minZoom: 3,
          restriction: {
            latLngBounds: { north: 72, south: 18, west: -179, east: -60 },
            strictBounds: false,
          },
          mapTypeControl: false,
          streetViewControl: false,
        });
        const info = new maps.InfoWindow();
        properties.forEach((property, index) => {
          const marker = new maps.Marker({
            map,
            position: { lat: property.latitude!, lng: property.longitude! },
            title: property.address,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              fillColor: rankColor(baseColor, index, properties.length),
              fillOpacity: 1,
              strokeColor: "#0f172a",
              strokeWeight: 2,
              scale: 9,
            },
          });
          markers.push(marker);
          listeners.push(
            marker.addListener("click", () => {
              const content = document.createElement("div");
              const title = document.createElement("p");
              const strong = document.createElement("strong");
              strong.textContent = `#${index + 1} in ${rankCategory}`;
              title.append(strong);
              content.append(title);
              [
                property.address,
                `${property.city}, ${property.state} ${property.zipCode}`,
                money(property.estimatedValue),
              ].forEach((line) => {
                const row = document.createElement("p");
                row.textContent = line;
                content.append(row);
              });
              const button = document.createElement("button");
              button.className = "mt-2 font-bold text-blue-700";
              button.textContent = "Open property";
              button.addEventListener("click", () => onSelect(property.id));
              content.append(button);
              info.setContent(content);
              info.open({ map, anchor: marker });
            }),
          );
        });
        if (properties.length === 1) {
          map.setCenter({
            lat: properties[0].latitude!,
            lng: properties[0].longitude!,
          });
          map.setZoom(14);
        } else if (properties.length > 1) {
          const bounds = new maps.LatLngBounds();
          properties.forEach((property) =>
            bounds.extend({
              lat: property.latitude!,
              lng: property.longitude!,
            }),
          );
          map.fitBounds(bounds, 40);
        }
        setError("");
      })
      .catch((caught: unknown) => {
        if (!disposed)
          setError(
            caught instanceof Error
              ? caught.message
              : "Google Maps could not be loaded.",
          );
      });

    return () => {
      disposed = true;
      listeners.forEach((listener) => listener.remove());
      markers.forEach((marker) => marker.setMap(null));
    };
  }, [apiKey, baseColor, onSelect, properties, rankCategory]);

  return (
    <div>
      <div
        aria-label="Google map of sourced properties"
        className="h-[430px] w-full"
        ref={node}
      />
      {error ? (
        <p className="border-t bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          {error} OpenStreetMap remains available if Google is not configured.
        </p>
      ) : null}
    </div>
  );
}
