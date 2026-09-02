"use client";

import { useState } from "react";
import Image from "next/image";
import { isSafePublicEvidenceUrl } from "@/lib/research-freshness";

type Photo = {
  url: string;
  altText: string;
  rightsStatus?: string;
  sourceName?: string;
  sourceUrl?: string;
};

export function PropertyPhoto({ photos, eager = false, className = "h-40" }: { photos: Photo[]; eager?: boolean; className?: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const photo = photos.find((item) => isSafePublicEvidenceUrl(item.url)
    && !failed.includes(item.url));
  return (
    <div className={`relative grid w-full place-items-center overflow-hidden bg-slate-100 ${className}`}>
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
      {photo?.sourceUrl && isSafePublicEvidenceUrl(photo.sourceUrl) ? (
        <a
          className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 px-3 py-1.5 text-[11px] font-medium text-white underline-offset-2 hover:underline"
          href={photo.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Photo source: {photo.sourceName || new URL(photo.sourceUrl).hostname}
        </a>
      ) : null}
    </div>
  );
}
