export const BUY_BOX_MATCH_CAP = 25;
export const BUY_BOX_BLOCKER_CODE = "BUYBOX_MATCH";

export type BuyBoxCriteria = {
  name: string;
  naturalLanguage?: string | null;
  states: string[];
  cities: string[];
  counties: string[];
  zipCodes: string[];
  propertyTypes: string[];
  minPriceCents: bigint | null;
  maxPriceCents: bigint | null;
  minSpreadCents: bigint | null;
  maxRepairCents: bigint | null;
};

export type BuyBoxProperty = {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  county?: string | null;
  propertyType?: string | null;
  estimatedValue?: number | null;
};

const dollarsToCents = (dollars: number) =>
  BigInt(Math.round(dollars)) * BigInt(100);

const norm = (value: string) => value.trim().toLowerCase();

function listHas(list: readonly string[], value?: string | null) {
  if (!list.length) return true;
  if (!value) return false;
  const needle = norm(value);
  return list.some((item) => norm(item) === needle);
}

export function propertyMatchesBuyBox(
  property: BuyBoxProperty,
  box: BuyBoxCriteria,
) {
  if (!listHas(box.states, property.state)) return false;
  if (!listHas(box.cities, property.city)) return false;
  if (!listHas(box.counties, property.county)) return false;
  if (!listHas(box.zipCodes, property.zipCode)) return false;
  if (!listHas(box.propertyTypes, property.propertyType)) return false;
  if (property.estimatedValue == null || property.estimatedValue <= 0) {
    return false;
  }
  const priceCents = dollarsToCents(property.estimatedValue);
  if (box.minPriceCents != null && priceCents < box.minPriceCents) return false;
  if (box.maxPriceCents != null && priceCents > box.maxPriceCents) return false;
  return true;
}

const MONEY =
  /\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?/i;

function parseMoneyToCents(raw: string) {
  const match = raw.match(MONEY);
  if (!match) return null;
  const amount = Number(match[1].replaceAll(",", ""));
  if (!Number.isFinite(amount)) return null;
  const suffix = (match[2] ?? "").toLowerCase();
  const dollars = suffix === "m" ? amount * 1_000_000 : suffix === "k" ? amount * 1_000 : amount;
  return dollarsToCents(dollars);
}

const TYPE_ALIASES: Record<string, string> = {
  house: "SFR",
  houses: "SFR",
  home: "SFR",
  homes: "SFR",
  sfr: "SFR",
  "single family": "SFR",
  townhome: "Townhouse",
  townhouse: "Townhouse",
  duplex: "Duplex",
  condo: "Condo",
  condos: "Condo",
};

export function parseBuyBoxPrompt(prompt: string): BuyBoxCriteria {
  const text = prompt.trim();
  const lower = text.toLowerCase();
  const maxPrice = /under\s+(\$?[\d,]+(?:\.\d+)?\s*[km]?)/i.exec(text);
  const minSpread =
    /(?:spread|assignment)\s+(?:of\s+)?(?:at least\s+)?(\$?[\d,]+(?:\.\d+)?\s*[km]?)/i.exec(
      text,
    ) ??
    /(?:at least\s+)?(\$?[\d,]+(?:\.\d+)?\s*[km]?)\s+(?:potential\s+)?(?:wholesale\s+)?spread/i.exec(
      text,
    );
  const zip = /\b(\d{5})\b/.exec(text);
  const state = /\b([A-Z]{2})\b/.exec(text);
  const inPlace = /\bin\s+([A-Za-z][A-Za-z\s]+?)(?:\s+under|\s+with|\s+and|,|$)/i.exec(
    text,
  );
  const types = Object.entries(TYPE_ALIASES)
    .filter(([alias]) => lower.includes(alias))
    .map(([, type]) => type);
  const uniqueTypes = [...new Set(types)];
  const city = inPlace?.[1]?.trim() ?? "";
  const looksLikeState = city.length === 2;
  return {
    name: text.slice(0, 80) || "Buy Box",
    naturalLanguage: text,
    states: state ? [state[1].toUpperCase()] : looksLikeState ? [city.toUpperCase()] : [],
    cities: city && !looksLikeState ? [city] : [],
    counties: [],
    zipCodes: zip ? [zip[1]] : [],
    propertyTypes: uniqueTypes,
    minPriceCents: null,
    maxPriceCents: maxPrice ? parseMoneyToCents(maxPrice[1]) : null,
    minSpreadCents: minSpread ? parseMoneyToCents(minSpread[1]) : null,
    maxRepairCents: null,
  };
}

export function selectBuyBoxMatches(
  properties: readonly BuyBoxProperty[],
  box: BuyBoxCriteria,
  cap = BUY_BOX_MATCH_CAP,
) {
  return properties.filter((property) => propertyMatchesBuyBox(property, box)).slice(0, cap);
}
