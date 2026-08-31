import { getPrisma } from "@/lib/prisma";
import { ownerIsAuthenticated } from "@/lib/auth";
import { evaluateGoogleVisualContextEnvironment } from "@/lib/google-visual-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function googleApiKey() {
  return process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() || "";
}

function placeholder(message: string, status = 404) {
  const safe = message.replace(/[<>&]/g, "");
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#f1f5f9"/><text x="320" y="180" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="20" fill="#64748b">${safe}</text></svg>`,
    {
      status,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, no-store",
      },
    },
  );
}

export async function GET(request: Request) {
  if (!(await ownerIsAuthenticated()))
    return placeholder("Owner authentication required", 401);

  const readiness = evaluateGoogleVisualContextEnvironment({
    serverFeaturesRequired: true,
  });
  if (!readiness.allowed)
    return placeholder("Property imagery is safely disabled", 503);

  const key = googleApiKey();
  if (!key) return placeholder("Property imagery unavailable", 503);

  const propertyId = new URL(request.url).searchParams.get("propertyId")?.trim();
  if (!propertyId) return placeholder("Property image unavailable", 400);

  const property = await getPrisma().property.findUnique({
    where: { id: propertyId },
    select: { address: true, city: true, state: true, zipCode: true },
  });
  if (!property) return placeholder("Property image unavailable", 404);

  const location = `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`;
  const metadataUrl = new URL("https://maps.googleapis.com/maps/api/streetview/metadata");
  metadataUrl.searchParams.set("location", location);
  metadataUrl.searchParams.set("key", key);

  try {
    const metadataResponse = await fetch(metadataUrl, { cache: "no-store" });
    const metadata = (await metadataResponse.json()) as {
      status?: string;
      location?: { lat?: number; lng?: number };
    };

    if (!metadataResponse.ok || metadata.status !== "OK")
      return placeholder("No verified street image found", 404);

    const imageUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
    imageUrl.searchParams.set("size", "640x360");
    imageUrl.searchParams.set("location", location);
    imageUrl.searchParams.set("fov", "90");
    imageUrl.searchParams.set("pitch", "0");
    imageUrl.searchParams.set("source", "outdoor");
    imageUrl.searchParams.set("return_error_code", "true");
    imageUrl.searchParams.set("key", key);

    const imageResponse = await fetch(imageUrl, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!imageResponse.ok) return placeholder("No verified street image found", 404);

    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/"))
      return placeholder("No verified street image found", 404);

    return new Response(await imageResponse.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "private, max-age=86400",
        "x-deal-scout-image-verification": "google-street-view-metadata-ok",
      },
    });
  } catch {
    return placeholder("Property imagery temporarily unavailable", 502);
  }
}
