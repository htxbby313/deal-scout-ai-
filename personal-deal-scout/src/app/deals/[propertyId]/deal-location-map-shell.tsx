"use client";

import dynamic from "next/dynamic";

const DealLocationMap = dynamic(
  () => import("@/app/deals/[propertyId]/deal-location-map").then((module) => module.DealLocationMap),
  { ssr: false },
);

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

export function DealLocationMapShell({ property }: { property: DealLocation }) {
  return <DealLocationMap property={property} />;
}
