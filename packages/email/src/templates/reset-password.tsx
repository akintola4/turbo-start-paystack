import { type EmailContent, firstName } from "../content";
import { Email } from "../components/email";
import type { EmailTheme } from "../theme";
import { type Themed, themeOf } from "./shared";

export type ResetPasswordProps = { name?: string; url: string };

export const resetPasswordSubject = (_props: ResetPasswordProps) =>
  "Reset your password";

export function resetPasswordContent(
  props: ResetPasswordProps,
  theme: EmailTheme
): EmailContent {
  return {
    billing: false,
    preview: `Choose a new password for ${theme.productName}. The link works once.`,
    title: `${theme.productName} account`,
    headline: "Reset your password",
    greetingName: firstName(props.name),
    body: [
      [
        `Someone asked to reset the password for your ${theme.productName} account. If that was you, choose a new one. The link works once and expires in an hour.`,
      ],
    ],
    cta: { label: "Choose a new password", href: props.url, showUrl: true },
    after: [
      [
        "Didn't ask for this? Ignore this email and your password stays the same.",
      ],
    ],
    reason: "Sent because a password reset was requested for this address.",
  };
}

export function ResetPassword(props: Themed<ResetPasswordProps>) {
  const theme = themeOf(props);
  return <Email content={resetPasswordContent(props, theme)} theme={theme} />;
}

ResetPassword.PreviewProps = {
  name: "Adaeze Okafor",
  url: "https://app.example.com/api/auth/reset-password/preview-token?callbackURL=%2Freset-password",
} satisfies ResetPasswordProps;
