"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

/**
 * GSAP for the marketing islands only. Plugins register once, on the client.
 * Every timeline is built inside `useGSAP` + `gsap.matchMedia()` so it is
 * reverted on unmount (client navigation) and has a reduced-motion branch.
 */
if (typeof window !== "undefined") {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
}

/** matchMedia conditions shared by the landing islands. Always include
 *  `reduce`: matchMedia skips the callback when no condition matches. */
export const MOTION_QUERIES = {
  motion: "(prefers-reduced-motion: no-preference)",
  reduce: "(prefers-reduced-motion: reduce)",
} as const;

/** Re-measure scroll positions once webfonts have changed line heights. */
export function refreshAfterFonts() {
  if (typeof document === "undefined") {
    return;
  }
  document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
}

export { gsap, ScrollTrigger, SplitText, useGSAP };
