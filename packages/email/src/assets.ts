import { ICONS, TONES } from "./content";

/**
 * Files the emails load from the app's `/email` folder
 * (apps/web/public/email), relative to it. The web app's tests check each
 * one exists, and `pnpm --filter @workspace/email icons` regenerates the
 * icons.
 */
export const EMAIL_FONT_FILES = [
  "fonts/geist-latin.woff2",
  "fonts/geist-mono-latin.woff2",
  "fonts/currency-symbols.woff2",
] as const;

export const emailIconFile = (icon: string, tone: string) =>
  `icons/${icon}-${tone}.png`;

export const EMAIL_ICON_FILES = ICONS.flatMap((icon) =>
  TONES.map((tone) => emailIconFile(icon, tone))
);

export const EMAIL_ASSET_FILES = [...EMAIL_FONT_FILES, ...EMAIL_ICON_FILES];
