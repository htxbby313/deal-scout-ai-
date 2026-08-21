"use client";

let mapsPromise: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google.maps> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires a browser."));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  const promise = new Promise<typeof google.maps>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-deal-scout-google-maps="true"]');
    const finish = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error("Google Maps loaded without its browser API."));
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Maps could not be loaded.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.dealScoutGoogleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Google Maps could not be loaded.")), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    mapsPromise = null;
    throw error;
  });
  mapsPromise = promise;
  return promise;
}
