"use client";

import { applyThemeColor, useThemeColor } from "@/lib/theme-color";

export function ThemeColorPicker() {
  const color = useThemeColor();
  return <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-bold text-slate-600"><span>App color</span><input aria-label="Application color" className="h-7 w-9 cursor-pointer rounded border bg-white p-0.5" onChange={(event) => applyThemeColor(event.target.value)} type="color" value={color} /></label>;
}
