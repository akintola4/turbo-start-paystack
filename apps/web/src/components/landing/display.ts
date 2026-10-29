import type { CSSProperties } from "react";

/**
 * Left side bearings of Geist SemiBold capitals and the lower-case letters
 * the landing's headings start with, in ems (measured from the font file).
 * A display heading is pulled left by its first letter's bearing so its ink,
 * not its glyph box, sits on the content edge. Stems ≈ 0.08, rounds ≈ 0.043.
 */
const BEARING: Record<string, number> = {
  B: 0.08,
  D: 0.08,
  E: 0.08,
  F: 0.08,
  H: 0.08,
  I: 0.08,
  K: 0.08,
  L: 0.08,
  M: 0.08,
  N: 0.08,
  P: 0.08,
  R: 0.08,
  U: 0.075,
  C: 0.043,
  G: 0.043,
  O: 0.043,
  Q: 0.043,
  S: 0.053,
  T: 0.011,
  Y: -0.007,
  i: 0.068,
  t: 0.045,
};

/** Inline style that puts `text`'s first letter on the content edge. */
export function opticalEdge(text: string): CSSProperties {
  const first = text.trimStart().charAt(0);
  return { marginInlineStart: `${-(BEARING[first] ?? 0.06)}em` };
}
