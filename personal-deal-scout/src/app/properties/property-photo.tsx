"use client";

import { useState } from "react";
import Image from "next/image";
import { isSafePublicEvidenceUrl } from "@/lib/research-freshness";

type Photo = { url: string; altText: string; rightsStatus?: string };

// Display does not require send approval. Distribution rights stay in the existing gate.
export function PropertyPhoto({ photos, eager = false }: { photos: Photo[]; eager?: boolean }) {
  const [failed, setFailed] = useState<string[]>([]);
  const photo = photos.find((item) => isSafePublicEvidenceUrl(item.url)
    && !["REJECTED", "RESTRICTED", "LINK_ONLY"].includes(item.rightsStatus || "")
    && !failed.includes(item.url));
  return (
    <div className="relative grid h-40 w-full place-items-center overflow-hidden bg-slate-100">
      {photo ? (
        <Image
          key={photo.url}
          alt={photo.altText}
          className="object-cover"
          fill
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed((previous) => [...previous, photo.url])}
          referrerPolicy="no-referrer"
          sizes="(min-width: 1536px) 33vw, (min-width: 768px) 50vw, 100vw"
          src={photo.url}
          unoptimized
        />
      ) : (
        <span className="px-4 text-center text-xs text-slate-500">
          {failed.length ? "Source image unavailable. Open the source link for details." : "No source photo available yet"}
        </span>
      )}
    </div>
  );
}
