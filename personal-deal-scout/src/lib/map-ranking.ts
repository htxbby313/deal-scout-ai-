export const US_MAP_BOUNDS: [[number, number], [number, number]] = [[18, -179], [72, -60]];

export const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

export function rankColor(baseColor: string, index: number, total: number) {
  const normalized = /^#[0-9a-f]{6}$/i.test(baseColor) ? baseColor : "#2563eb";
  const channels = [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  const progress = total <= 1 ? 0 : index / (total - 1);
  const whiteMix = progress * 0.78;
  return `#${channels.map((channel) => Math.round(channel + (255 - channel) * whiteMix).toString(16).padStart(2, "0")).join("")}`;
}
