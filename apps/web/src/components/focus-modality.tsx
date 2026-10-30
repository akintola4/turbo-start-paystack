"use client";

import { useEffect } from "react";

const MODIFIERS = new Set(["Meta", "Control", "Alt", "Shift"]);

/**
 * Records how the user last interacted on <html data-modality>. Browsers
 * can match :focus-visible when script moves focus after a click (a popup
 * returning focus to its trigger, Safari treating script focus as
 * keyboard focus), which leaves a ring on a button the user clicked.
 * globals.css hides the ring while the modality is "pointer"; the next
 * key press (Tab, arrows, Escape) brings it back before focus moves.
 */
export function FocusModality() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => {
      root.dataset.modality = "pointer";
    };
    const key = (e: KeyboardEvent) => {
      if (!MODIFIERS.has(e.key)) {
        root.dataset.modality = "keyboard";
      }
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", key, true);
      delete root.dataset.modality;
    };
  }, []);
  return null;
}
