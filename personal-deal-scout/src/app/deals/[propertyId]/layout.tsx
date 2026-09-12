import Link from "next/link";

export default async function DealPropertyLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ propertyId: string }>;
}>) {
  const { propertyId } = await params;
  return (
    <>
      <nav className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6 lg:px-8" aria-label="Deal navigation">
        <div className="mx-auto flex max-w-[1400px] flex-wrap gap-2 text-sm font-semibold">
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href={`/deals/${propertyId}`}>
            Deal Overview
          </Link>
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href={`/deals/${propertyId}/intelligence`}>
            Property Intelligence
          </Link>
          <Link className="rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href={`/deals/${propertyId}/package`}>
            Deal Package
          </Link>
        </div>
      </nav>
      {children}
    </>
  );
}
