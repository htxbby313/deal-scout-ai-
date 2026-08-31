import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function googleApiKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.GOOGLE_CLOUD_API_KEY ||
    ""
  );
}

function placeholder(message: string, status = 404) {
  const safe = message.replace(/[<>&]/g, "");
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#f1f5f9"/><text x="320" y="180" text-anchor="middle" dominant-baseline="middle" font-family="Arial,sans-serif" font-size="20" fill="#64748b">${safe}</text></svg>`,
    {
      status,
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    },
  );
}

export async function GET(request: Request) {
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
    const metadataResponse = await fetch(metadataUrl, {
      cache: "force-cache",
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
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
        "cache-control": "public, s-maxage=2592000, stale-while-revalidate=86400",
        "x-deal-scout-image-verification": "google-street-view-metadata-ok",
      },
    });
  } catch {
    return placeholder("Property imagery temporarily unavailable", 502);
  }
}
