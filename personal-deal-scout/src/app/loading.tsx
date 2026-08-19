export default function Loading() {
  return <main aria-busy="true" aria-live="polite" className="grid min-h-screen place-items-center bg-[#f4f7fb] p-6"><div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-blue-700">Deal Scout</p><h1 className="mt-1 text-xl font-bold">Loading verified records</h1><p className="mt-2 text-sm text-slate-600">Research, approvals, holds, and financial truth are being read from the system of record.</p><div className="mt-5 h-2 animate-pulse rounded-full bg-slate-200" /></div></main>;
}
