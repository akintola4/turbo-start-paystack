import { defaultTheme, type EmailTheme } from "../theme";

export type Themed<P> = P & { theme?: EmailTheme };

export const themeOf = (props: { theme?: EmailTheme }) =>
  props.theme ?? defaultTheme;

export const billingReason = (organizationName: string, theme: EmailTheme) =>
  `You're receiving this because you manage billing for ${organizationName} on ${theme.productName}.`;
