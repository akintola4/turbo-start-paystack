"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

import { THEME_COLOR } from "@/lib/brand";

/**
 * The theme-color tags follow prefers-color-scheme, but the theme switch can
 * override the OS. Point both tags at the chosen theme, so the status bar
 * matches the page; on "system" they go back to their media queries.
 */
export function ThemeColor() {
  const { theme, resolvedTheme } = useTheme();
  useEffect(() => {
    const forced = theme === "light" || theme === "dark" ? resolvedTheme : null;
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      const own = meta.media.includes("dark")
        ? THEME_COLOR.dark
        : THEME_COLOR.light;
      meta.content =
        forced === "dark" || forced === "light" ? THEME_COLOR[forced] : own;
    }
  }, [theme, resolvedTheme]);
  return null;
}
