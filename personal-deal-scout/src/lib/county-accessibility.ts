export type CountyAccessibilityStatus = "AUTOMATED" | "MANUAL_ONLY" | "RESTRICTED" | "PAYWALLED" | "TEMPORARILY_UNAVAILABLE" | "NOT_FOUND" | "NEEDS_REVIEW";

const privateIpv4 = /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

export function safeCountyAccessibilityUrl(raw: string) {
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || hostname === "localhost" || hostname === "[::1]" || hostname === "::1" || hostname.endsWith(".local") || hostname.endsWith(".internal") || privateIpv4.test(hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export function classifyCountyAccessibility(input: {
  automationStatus: "PERMITTED" | "RESTRICTED" | "UNKNOWN" | "PROHIBITED";
  authenticationRequired: boolean;
  subscriptionRequired: boolean;
  robotsStatus?: string | null;
  httpStatus?: number | null;
  networkFailure?: boolean;
}) {
  if (input.subscriptionRequired || input.httpStatus === 402) return { status: "PAYWALLED" as const, reason: "Subscription or payment is required." };
  if (input.authenticationRequired) return { status: "MANUAL_ONLY" as const, reason: "Authentication is required; no automated access attempted." };
  if (input.automationStatus === "RESTRICTED" || input.automationStatus === "PROHIBITED" || input.robotsStatus?.toLowerCase() === "prohibited") return { status: "RESTRICTED" as const, reason: "Recorded source terms or robots policy do not permit automation." };
  if (input.automationStatus !== "PERMITTED") return { status: "NEEDS_REVIEW" as const, reason: "Automation permission has not been verified." };
  if (input.networkFailure || (input.httpStatus != null && (input.httpStatus === 429 || input.httpStatus >= 500))) return { status: "TEMPORARILY_UNAVAILABLE" as const, reason: "The permitted official source was temporarily unavailable." };
  if (input.httpStatus === 404 || input.httpStatus === 410) return { status: "NOT_FOUND" as const, reason: "The recorded official endpoint was not found." };
  if (input.httpStatus === 401 || input.httpStatus === 403) return { status: "MANUAL_ONLY" as const, reason: "The official endpoint requires manual or authenticated access." };
  if (input.httpStatus != null && input.httpStatus >= 300 && input.httpStatus < 400) return { status: "NEEDS_REVIEW" as const, reason: "The official endpoint redirected; its destination requires verification." };
  if (input.httpStatus != null && input.httpStatus >= 200 && input.httpStatus < 300) return { status: "AUTOMATED" as const, reason: "The permitted official endpoint responded successfully." };
  return { status: "NEEDS_REVIEW" as const, reason: "The official endpoint response requires review." };
}

export function requireReviewedCountyAdapter(input: { status: CountyAccessibilityStatus; adapterVersion?: string | null; parserVersion?: string | null; hasStructuredEndpoint: boolean }) {
  if (input.status !== "AUTOMATED") return { status: input.status, reason: null };
  if (!input.adapterVersion || !input.parserVersion || !input.hasStructuredEndpoint) return { status: "NEEDS_REVIEW" as const, reason: "The official source is accessible, but no reviewed query adapter and parser are registered." };
  return { status: "AUTOMATED" as const, reason: null };
}
