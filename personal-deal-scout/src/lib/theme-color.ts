"use client";

import { useSyncExternalStore } from "react";

export const DEFAULT_THEME_COLOR = "#1d4ed8";
const THEME_EVENT = "deal-scout-theme-change";
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function snapshot() {
  if (typeof document === "undefined") return DEFAULT_THEME_COLOR;
  const color = document.documentElement.dataset.themeColor;
  return color && COLOR_PATTERN.test(color) ? color : DEFAULT_THEME_COLOR;
}

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(THEME_EVENT, callback); window.removeEventListener("storage", callback); };
}

export function applyThemeColor(color: string) {
  const safeColor = COLOR_PATTERN.test(color) ? color : DEFAULT_THEME_COLOR;
  document.documentElement.dataset.themeColor = safeColor;
  document.documentElement.style.setProperty("--accent", safeColor);
  window.localStorage.setItem("deal-scout-theme-color-v1", safeColor);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useThemeColor() {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_THEME_COLOR);
}
