"use client";

import dynamic from "next/dynamic";

const DevelopmentRadarMap = dynamic(() => import("@/app/research/development-radar-map"), { ssr: false });

export type RadarMapSignal = { id: string; fips: string; stateFips: string; countyName: string; stateName: string; currentUnits: number; growthPct: number | null; currentValue: string; sourceUrl: string; countyCoverageStatus: string; countyCoverageReason: string; countyCoverageCheckedAt: string | null; countyCoverageNextReviewAt: string | null };
export type RadarMapListing = { id: string; address: string; city: string; state: string; zipCode: string; county?: string; neighborhood?: string; latitude: number; longitude: number; estimatedValue?: number; marketFips?: string };

export function DevelopmentRadarMapShell({ signals, listings, rankCategory }: { signals: RadarMapSignal[]; listings: RadarMapListing[]; rankCategory: string }) {
  return <DevelopmentRadarMap listings={listings} rankCategory={rankCategory} signals={signals} />;
}
