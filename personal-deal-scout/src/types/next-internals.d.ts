declare module "next/dist/build/segment-config/app/app-segment-config.js" {
  export type InstantConfigForTypeCheckInternal = unknown;
}

declare module "next/dist/lib/metadata/types/metadata-interface.js" {
  export type ResolvingMetadata = unknown;
  export type ResolvingViewport = unknown;
}

declare module "next/navigation" {
  export function redirect(path: string): never;
}

declare module "next/cache" {
  export function revalidatePath(path: string): void;
}

declare module "next/headers" {
  export function cookies(): Promise<{
    get(name: string): { value: string } | undefined;
    set(name: string, value: string, options?: Record<string, unknown>): void;
  }>;
}

declare module "next/server" {
  export class NextRequest extends Request {
    nextUrl: URL;
  }
  export class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse;
  }
}
