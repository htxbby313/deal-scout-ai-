declare module "next/types.js" {
  export type {
    ResolvingMetadata,
    ResolvingViewport,
  } from "next/dist/lib/metadata/types/metadata-interface";
}

declare module "next/server.js" {
  export type NextRequest = Request & {
    nextUrl?: URL;
  };
}

declare module "next/server" {
  export type NextRequest = Request & {
    nextUrl?: URL;
  };
  export const NextResponse: {
    json(body: unknown, init?: ResponseInit): Response;
  };
}
