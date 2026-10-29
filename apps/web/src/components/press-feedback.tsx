"use client";

import { useEffect } from "react";

const PRESSABLE = ".pressable";

/**
 * Makes press feedback work everywhere `pressable` is used:
 * - iOS Safari only applies `:active` on touch once the page listens for
 *   touchstart, so we add an empty passive listener.
 * - Enter and Space set `data-pressed` on the pressed control while the key
 *   is down, so keyboard presses get the same scale as a pointer.
 */
export function PressFeedback() {
  useEffect(() => {
    const noop = () => {};
    let pressed: HTMLElement | null = null;
    const release = () => {
      pressed?.removeAttribute("data-pressed");
      pressed = null;
    };
    const down = (e: KeyboardEvent) => {
      if ((e.key !== "Enter" && e.key !== " ") || e.repeat) {
        return;
      }
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        PRESSABLE
      );
      if (el) {
        release();
        pressed = el;
        el.setAttribute("data-pressed", "");
      }
    };
    document.addEventListener("touchstart", noop, { passive: true });
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", release);
    window.addEventListener("blur", release);
    return () => {
      document.removeEventListener("touchstart", noop);
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", release);
      window.removeEventListener("blur", release);
    };
  }, []);
  return null;
}
