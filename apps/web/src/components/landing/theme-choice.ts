"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

import type { SegmentOption } from "@/components/landing/segmented";

export type ThemeValue = "light" | "dark" | "system";

export const THEME_OPTIONS: readonly SegmentOption<ThemeValue>[] = [
  { value: "light", label: "Light", icon: SunIcon, iconMotion: "spin" },
  { value: "dark", label: "Dark", icon: MoonIcon, iconMotion: "tilt" },
  { value: "system", label: "System", icon: MonitorIcon, iconMotion: "pop" },
];

const resolve = (value: ThemeValue) =>
  value === "system"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : value;

/**
 * The visitor's theme choice for the switches on the landing (footer and
 * receipt). next-themes stores it and applies it before paint; `current` is
 * null until mount, because the server can't know it.
 *
 * `setTheme(value, from)` reveals the new theme as a circle growing from the
 * control that was pressed (View Transitions). Without support, or under
 * reduced motion, it swaps instantly. The class is flipped inside the
 * transition callback so the new snapshot is already the new theme.
 */
export function useThemeChoice() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current: ThemeValue | null = mounted
    ? theme === "light" || theme === "dark"
      ? theme
      : "system"
    : null;

  const choose = (value: ThemeValue, from?: HTMLElement) => {
    const root = document.documentElement;
    const before = root.classList.contains("dark") ? "dark" : "light";
    const after = resolve(value);
    const apply = () => {
      flushSync(() => setTheme(value));
      root.classList.toggle("dark", after === "dark");
      root.style.colorScheme = after;
    };
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const supported = typeof document.startViewTransition === "function";
    if (!(supported && from) || reduce || before === after) {
      apply();
      return;
    }
    const r = from.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );
    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
            pseudoElement: "::view-transition-new(root)",
          }
        );
      })
      .catch(() => {});
  };

  return { current, setTheme: choose };
}
