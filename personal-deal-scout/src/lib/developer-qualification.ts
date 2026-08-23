export type DeveloperContactProfile = {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  contactUrl?: string | null;
  contactName?: string | null;
};

export function developerRelationshipQualification(developer: DeveloperContactProfile) {
  const channels = [developer.website, developer.contactUrl, developer.email, developer.phone].filter((value) => Boolean(value?.trim())).length;
  if (channels >= 2 && developer.contactName?.trim()) return "PRIORITY" as const;
  if (channels >= 1) return "QUALIFIED" as const;
  return "RESEARCH_NEEDED" as const;
}
