/**
 * Everything brandable lives here. Set the product name, logo and support
 * link from env (see `apps/web/src/server/context.ts`); change the colours in
 * `defaultTheme` or pass overrides to `createMailer({ theme })`.
 */
export type EmailTheme = {
  productName: string;
  /** Absolute https URL of a logo about 2× its displayed 28px height. Without
   *  it the product name is shown as a wordmark. */
  logoUrl?: string;
  /** Where "Contact support" points (https or mailto). Omitted when unset. */
  supportUrl?: string;
  fontFamily: string;
  colors: {
    /** Page behind the card. */
    canvas: string;
    surface: string;
    border: string;
    heading: string;
    text: string;
    muted: string;
    /** Primary button background and link colour. */
    brand: string;
    /** Text on the primary button. */
    brandText: string;
    /** Background of callouts and the details table header. */
    subtle: string;
    /** Left rule of warning callouts. */
    warning: string;
  };
  /** Used by clients that honour `prefers-color-scheme` (Apple Mail, iOS
   *  Mail, Outlook.com, Outlook for Mac). Gmail and Outlook for Windows
   *  apply their own inversion to the light colours. */
  dark: EmailTheme["colors"];
};

export const defaultTheme: EmailTheme = {
  productName: "Turbo Start",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  colors: {
    canvas: "#f4f4f5",
    surface: "#ffffff",
    border: "#e4e4e7",
    heading: "#18181b",
    text: "#3f3f46",
    muted: "#71717a",
    brand: "#18181b",
    brandText: "#ffffff",
    subtle: "#f4f4f5",
    warning: "#d97706",
  },
  dark: {
    canvas: "#09090b",
    surface: "#18181b",
    border: "#3f3f46",
    heading: "#fafafa",
    text: "#d4d4d8",
    muted: "#a1a1aa",
    brand: "#fafafa",
    brandText: "#18181b",
    subtle: "#27272a",
    warning: "#f59e0b",
  },
};

export type EmailThemeOverrides = Partial<
  Omit<EmailTheme, "colors" | "dark">
> & {
  colors?: Partial<EmailTheme["colors"]>;
  dark?: Partial<EmailTheme["dark"]>;
};

export function createTheme(overrides: EmailThemeOverrides = {}): EmailTheme {
  return {
    ...defaultTheme,
    ...stripUndefined(overrides),
    colors: { ...defaultTheme.colors, ...overrides.colors },
    dark: { ...defaultTheme.dark, ...overrides.dark },
  };
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}
