import { type EmailContent, firstName } from "../content";
import { Email } from "../components/email";
import type { EmailTheme } from "../theme";
import { type Themed, themeOf } from "./shared";

export type VerifyEmailProps = {
  /** The account's display name; omitted from the greeting when empty. */
  name?: string;
  url: string;
};

export const verifyEmailSubject = (_props: VerifyEmailProps) =>
  "Confirm your email address";

export function verifyEmailContent(
  props: VerifyEmailProps,
  theme: EmailTheme
): EmailContent {
  return {
    billing: false,
    preview: `One click and your ${theme.productName} account is ready.`,
    title: `${theme.productName} account`,
    headline: "Confirm your email",
    greetingName: firstName(props.name),
    body: [
      [
        `Confirm this is your address to finish setting up ${theme.productName}. The link works for one hour.`,
      ],
    ],
    cta: { label: "Confirm email", href: props.url, showUrl: true },
    after: [
      [
        "Didn't sign up? Ignore this email. The account stays unconfirmed and can't be used.",
      ],
    ],
    reason: `Sent because this address was used to sign up for ${theme.productName}.`,
  };
}

export function VerifyEmail(props: Themed<VerifyEmailProps>) {
  const theme = themeOf(props);
  return <Email content={verifyEmailContent(props, theme)} theme={theme} />;
}

VerifyEmail.PreviewProps = {
  name: "Adaeze Okafor",
  url: "https://app.example.com/api/auth/verify-email?token=preview-token&callbackURL=%2Fapp",
} satisfies VerifyEmailProps;
