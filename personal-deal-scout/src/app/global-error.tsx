"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto max-w-lg p-8">
          <h1 className="text-xl font-semibold">Deal Scout could not load</h1>
          <p className="mt-2 text-sm text-slate-600">The request failed safely. No outbound action was taken.</p>
          <button className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-white" onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
