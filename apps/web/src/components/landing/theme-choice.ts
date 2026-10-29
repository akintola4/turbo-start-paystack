"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

export type ThemeValue = (typeof THEMES)[number]["value"];

/**
 * The visitor's theme choice for the switches on the landing (footer and
 * receipt). next-themes stores it and applies it before paint; `current`
 * is null until mount, because the server can't know it, so nothing renders
 * as selected for a moment instead of rendering the wrong one.
 */
export function useThemeChoice() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current: ThemeValue | null = mounted
    ? ((THEMES.find((t) => t.value === theme)?.value ?? "system") as ThemeValue)
    : null;
  return { current, setTheme: (value: ThemeValue) => setTheme(value) };
}
