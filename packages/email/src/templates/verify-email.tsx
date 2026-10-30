import { type EmailContent, firstName } from "../content";
import { Email } from "../components/email";
import type { EmailTheme } from "../theme";
import { type Themed, themeOf } from "./shared";

export type VerifyEmailProps = {
  /** The account's display name; omitted from the greeting when empty. */
  name?: string;
  url: string;
  /** "change-email": the link goes to a new address for an existing
   *  account. Defaults to confirming a new sign-up. */
  purpose?: "sign-up" | "change-email";
};

export const verifyEmailSubject = (props: VerifyEmailProps) =>
  props.purpose === "change-email"
    ? "Confirm your new email address"
    : "Confirm your email address";

export function verifyEmailContent(
  props: VerifyEmailProps,
  theme: EmailTheme
): EmailContent {
  if (props.purpose === "change-email") {
    return {
      billing: false,
      preview: `Confirm this address to use it for ${theme.productName}.`,
      title: `${theme.productName} account`,
      headline: "Confirm your new email",
      greetingName: firstName(props.name),
      body: [
        [
          `You asked to sign in to ${theme.productName} with this address. Confirm it and it replaces your old one. The link works for one hour.`,
        ],
      ],
      cta: { label: "Confirm new email", href: props.url, showUrl: true },
      after: [
        [
          "Didn't ask for this? Ignore this email. Nothing changes until the link is used.",
        ],
      ],
      reason: `Sent because this address was entered as the new email for a ${theme.productName} account.`,
    };
  }
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
