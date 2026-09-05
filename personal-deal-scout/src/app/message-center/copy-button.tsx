"use client";

import { useState } from "react";

export function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-lg border px-4 py-2 text-sm font-bold"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
