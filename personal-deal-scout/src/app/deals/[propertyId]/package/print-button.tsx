"use client";

export function PrintButton() {
  return (
    <button
      className="rounded-xl bg-slate-950 px-4 py-2 text-white"
      onClick={() => window.print()}
      type="button"
    >
      Print or save PDF
    </button>
  );
}
