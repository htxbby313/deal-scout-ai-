export const DEFAULT_COMPANY_NAME = "Coleman & Co. Holdings LLC";

export type OwnerProfile = {
  displayName: string;
  companyName: string;
  phone: string;
  email: string;
  markets: string[];
};

export function ownerPackageByline(profile: OwnerProfile) {
  const who = [profile.displayName, profile.companyName].filter(Boolean);
  return who.length ? who.join(" · ") : DEFAULT_COMPANY_NAME;
}

export const csvMarkets = (value: string) =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
