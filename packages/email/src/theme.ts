/**
 * Everything brandable lives here. Set the product name, logo and support
 * link from env (see `apps/web/src/server/context.ts`); change the colours in
 * `defaultTheme` or pass overrides to `createMailer({ theme })`.
 *
 * The palette is the app's "Market" palette (docs/design-system.md): a
 * green-tinted neutral ramp, the forest panel and sunflower for "yours".
 */

export type EmailColors = {
  /** Page behind everything. */
  canvas: string;
  /** Cards and the reading surface. */
  surface: string;
  /** Inner wells and callouts. */
  well: string;
  text: string;
  muted: string;
  /** Hairlines between rows. */
  rule: string;
  /** Heavy rules (statement header and totals). */
  ruleStrong: string;
  /** Primary button background. */
  brand: string;
  /** Text on the primary button. */
  brandText: string;
  link: string;
  /** Sunflower: marks "you / yours / this one". */
  accent: string;
  onAccent: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
};

/** The forest money panel. The same in light and dark mode. */
export type PanelColors = {
  panel: string;
  tile: string;
  /** Hairline edge of in-panel buttons. */
  line: string;
  text: string;
  muted: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  quiet: string;
};

export type EmailTheme = {
  productName: string;
  /** Absolute https URL of a logo about 2x its displayed 28px height. Without
   *  it the product name is shown as a wordmark. */
  logoUrl?: string;
  /** Where "Contact support" points (https or mailto). Omitted when unset. */
  supportUrl?: string;
  /** Absolute URL of the folder that serves `fonts/` and `icons/` (the app's
   *  `/email`). Without it no web fonts or icons are referenced, and every
   *  email falls back to the system stack and text-only status. */
  assetsUrl?: string;
  /** Web-font stack. Geist loads in Apple Mail, iOS Mail and Outlook for Mac;
   *  everywhere else the Helvetica/Arial fallback renders, whose figures are
   *  tabular by default and which include ₦ and ₵. */
  fontFamily: string;
  monoFamily: string;
  colors: EmailColors;
  /** Used by clients that honour `prefers-color-scheme` (Apple Mail, iOS
   *  Mail, Outlook for Mac) and Outlook.com (`[data-ogsc]`). Gmail and
   *  Outlook for Windows apply their own inversion to the light colours. */
  dark: EmailColors;
  panel: PanelColors;
};

export const defaultTheme: EmailTheme = {
  productName: "Turbo Start",
  fontFamily:
    "Geist,'Currency Symbols','Helvetica Neue',Helvetica,Arial,sans-serif",
  monoFamily:
    "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
  colors: {
    canvas: "#f3f8f6",
    surface: "#fcfefd",
    well: "#edf3ef",
    text: "#131d18",
    muted: "#535e58",
    rule: "#d7e1dc",
    ruleStrong: "#0f3a25",
    brand: "#0f3a25",
    brandText: "#e8efeb",
    link: "#1d6644",
    accent: "#eac531",
    onAccent: "#231901",
    success: "#326a2d",
    warning: "#905203",
    danger: "#b6322d",
    info: "#266595",
  },
  dark: {
    canvas: "#0e1311",
    surface: "#131a17",
    well: "#1a231e",
    text: "#e8efeb",
    muted: "#a2aea8",
    rule: "#252e29",
    ruleStrong: "#afccbb",
    brand: "#e8efeb",
    brandText: "#0f3a25",
    link: "#92d4af",
    accent: "#eac531",
    onAccent: "#231901",
    success: "#8cd384",
    warning: "#fcb26f",
    danger: "#fe9b93",
    info: "#92c4ee",
  },
  panel: {
    panel: "#0f3a25",
    tile: "#274e3b",
    line: "#4b6b5b",
    text: "#e8efeb",
    muted: "#afccbb",
    success: "#8cd384",
    warning: "#fcb26f",
    danger: "#fe9b93",
    info: "#92c4ee",
    quiet: "#afccbb",
  },
};

export type EmailThemeOverrides = Partial<
  Omit<EmailTheme, "colors" | "dark" | "panel">
> & {
  colors?: Partial<EmailColors>;
  dark?: Partial<EmailColors>;
  panel?: Partial<PanelColors>;
};

export function createTheme(overrides: EmailThemeOverrides = {}): EmailTheme {
  return {
    ...defaultTheme,
    ...stripUndefined(overrides),
    colors: { ...defaultTheme.colors, ...overrides.colors },
    dark: { ...defaultTheme.dark, ...overrides.dark },
    panel: { ...defaultTheme.panel, ...overrides.panel },
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
