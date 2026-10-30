/**
 * The product mark's geometry: a forest tile woven from a 3×3 grid whose
 * middle column slips half a step, with the sunflower cell in the slip.
 * One source for the <Mark> component, the favicon and the generated images.
 * Units are a 64×64 viewBox.
 */

export const MARK_VIEWBOX = 64;
export const MARK_RADIUS = 16;
export const CELL = 12;
export const CELL_RADIUS = 3.5;

/** Top-left corners of the eight forest cells. */
export const MARK_CELLS: readonly (readonly [number, number])[] = [
  [10, 7],
  [10, 23],
  [10, 39],
  [26, 13],
  [26, 45],
  [42, 7],
  [42, 23],
  [42, 39],
];

/** The sunflower cell, in the middle of the slipped column. */
export const MARK_LIT: readonly [number, number] = [26, 29];

/**
 * Hex values for the generated images, which can't read CSS variables.
 * They match --panel, --panel-tile, --highlight and friends in the theme.
 */
export const BRAND = {
  forest: "#0f3a25",
  forestTile: "#274e3b",
  cell: "#3b6450",
  cellOnPanel: "#46735c",
  sunflower: "#eac532",
  ink: "#231901",
  paper: "#e8efeb",
  muted: "#b9cfc3",
} as const;

/** The browser chrome's colour per theme: --background (neutral-50 / -950). */
export const THEME_COLOR = { light: "#f3f8f6", dark: "#0e1311" } as const;
