"use client";

import { OpenStreetPropertyMap } from "@/app/openstreet-maps";

type DealLocation = {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  estimatedValue?: number;
};

export function DealLocationMap({ property }: { property: DealLocation }) {
  return <OpenStreetPropertyMap baseColor="#1d4ed8" properties={[property]} rankCategory="deal location" />;
}
