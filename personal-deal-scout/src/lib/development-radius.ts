import { US_STATE_CODES } from "@/lib/map-ranking";

export const DEVELOPMENT_RADIUS_MILES = 15;

export type DevelopmentDistanceBand = "0-5" | "5-10" | "10-15";

export type PersistedCoordinates = {
  latitude: number;
  longitude: number;
};

export type PersistedPropertyLocation = PersistedCoordinates & {
  propertyId: string;
  stateCode: string;
  countryCode: string;
};

export type PersistedDevelopmentEvidence = PersistedCoordinates & {
  developmentId: string;
  stateCode: string;
  countryCode: string;
  verificationStatus: string;
  sourceUrl: string;
  verifiedAt: string;
  confidence?: number | null;
};

export type DevelopmentRadiusMatch = {
  propertyId: string;
  developmentId: string;
  distanceMiles: number;
  distanceBand: DevelopmentDistanceBand;
  sourceUrl: string;
  verifiedAt: string;
  confidence: number | null;
};

export type RankedDevelopmentProperty = {
  rank: number;
  propertyId: string;
  strongestBand: DevelopmentDistanceBand;
  nearestDistanceMiles: number;
  verifiedEvidenceCount: number;
  highestConfidence: number | null;
  matches: DevelopmentRadiusMatch[];
};

function isFiniteCoordinate(location: PersistedCoordinates) {
  return Number.isFinite(location.latitude)
    && Number.isFinite(location.longitude)
    && location.latitude >= -90
    && location.latitude <= 90
    && location.longitude >= -180
    && location.longitude <= 180;
}

function isUnitedStatesLocation(location: { countryCode: string; stateCode: string }) {
  return location.countryCode.trim().toUpperCase() === "US"
    && US_STATE_CODES.has(location.stateCode.trim().toUpperCase());
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
}

export function distanceMilesBetween(first: PersistedCoordinates, second: PersistedCoordinates) {
  if (!isFiniteCoordinate(first) || !isFiniteCoordinate(second)) return null;

  const earthRadiusMiles = 3958.7613;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function developmentDistanceBand(distanceMiles: number): DevelopmentDistanceBand | null {
  if (!Number.isFinite(distanceMiles) || distanceMiles < 0) return null;
  if (distanceMiles <= 5) return "0-5";
  if (distanceMiles <= 10) return "5-10";
  if (distanceMiles <= DEVELOPMENT_RADIUS_MILES) return "10-15";
  return null;
}

export function isVerifiedDevelopmentEvidence(evidence: PersistedDevelopmentEvidence) {
  return evidence.verificationStatus === "VERIFIED"
    && evidence.sourceUrl.trim().length > 0
    && evidence.verifiedAt.trim().length > 0
    && isUnitedStatesLocation(evidence)
    && isFiniteCoordinate(evidence);
}

function normalizedConfidence(confidence: number | null | undefined) {
  if (confidence == null || !Number.isFinite(confidence)) return null;
  return Math.min(1, Math.max(0, confidence));
}

export function matchPropertiesToVerifiedDevelopments(
  properties: readonly PersistedPropertyLocation[],
  evidence: readonly PersistedDevelopmentEvidence[],
) {
  const verifiedEvidence = evidence.filter(isVerifiedDevelopmentEvidence);
  const matches: DevelopmentRadiusMatch[] = [];

  for (const property of properties) {
    if (!isUnitedStatesLocation(property) || !isFiniteCoordinate(property)) continue;

    for (const development of verifiedEvidence) {
      const distanceMiles = distanceMilesBetween(property, development);
      if (distanceMiles == null) continue;
      const distanceBand = developmentDistanceBand(distanceMiles);
      if (!distanceBand) continue;

      matches.push({
        propertyId: property.propertyId,
        developmentId: development.developmentId,
        distanceMiles,
        distanceBand,
        sourceUrl: development.sourceUrl,
        verifiedAt: development.verifiedAt,
        confidence: normalizedConfidence(development.confidence),
      });
    }
  }

  return matches.sort((left, right) => left.distanceMiles - right.distanceMiles
    || right.verifiedAt.localeCompare(left.verifiedAt)
    || left.propertyId.localeCompare(right.propertyId)
    || left.developmentId.localeCompare(right.developmentId));
}

const bandOrder: Record<DevelopmentDistanceBand, number> = {
  "0-5": 0,
  "5-10": 1,
  "10-15": 2,
};

export function rankPropertiesByDevelopmentEvidence(matches: readonly DevelopmentRadiusMatch[]) {
  const matchesByProperty = new Map<string, DevelopmentRadiusMatch[]>();
  for (const match of matches) {
    const propertyMatches = matchesByProperty.get(match.propertyId) ?? [];
    propertyMatches.push(match);
    matchesByProperty.set(match.propertyId, propertyMatches);
  }

  const ranked: Omit<RankedDevelopmentProperty, "rank">[] = [];
  for (const [propertyId, propertyMatches] of matchesByProperty) {
    const sortedMatches = [...propertyMatches].sort((left, right) => left.distanceMiles - right.distanceMiles);
    const confidences = sortedMatches.flatMap((match) => match.confidence == null ? [] : [match.confidence]);
    ranked.push({
      propertyId,
      strongestBand: sortedMatches[0].distanceBand,
      nearestDistanceMiles: sortedMatches[0].distanceMiles,
      verifiedEvidenceCount: sortedMatches.length,
      highestConfidence: confidences.length > 0 ? Math.max(...confidences) : null,
      matches: sortedMatches,
    });
  }

  return ranked
    .sort((left, right) => bandOrder[left.strongestBand] - bandOrder[right.strongestBand]
      || right.verifiedEvidenceCount - left.verifiedEvidenceCount
      || (right.highestConfidence ?? -1) - (left.highestConfidence ?? -1)
      || left.nearestDistanceMiles - right.nearestDistanceMiles
      || left.propertyId.localeCompare(right.propertyId))
    .map((candidate, index): RankedDevelopmentProperty => ({ ...candidate, rank: index + 1 }));
}
