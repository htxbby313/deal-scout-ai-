"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ idleLabel, pendingLabel, className }: { idleLabel: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return <button aria-disabled={pending} className={`${className} disabled:cursor-wait disabled:opacity-60`} disabled={pending} type="submit">{pending ? pendingLabel : idleLabel}</button>;
}
