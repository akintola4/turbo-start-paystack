import { type EmailContent, firstName } from "../content";
import { Email } from "../components/email";
import type { EmailTheme } from "../theme";
import { type Themed, themeOf } from "./shared";

export type ChangeEmailApprovalProps = {
  /** The account's display name; omitted from the greeting when empty. */
  name?: string;
  /** The address the account would move to. */
  newEmail: string;
  /** Approves the change; a confirmation link then goes to `newEmail`. */
  url: string;
};

export const changeEmailApprovalSubject = (_props: ChangeEmailApprovalProps) =>
  "Approve the change to your email address";

/** Sent to the current address when someone asks to move the account to a
 *  new one. Nothing changes unless this link and then the new address's
 *  link are both used. */
export function changeEmailApprovalContent(
  props: ChangeEmailApprovalProps,
  theme: EmailTheme
): EmailContent {
  return {
    billing: false,
    preview: `Someone asked to move your ${theme.productName} account to ${props.newEmail}.`,
    title: `${theme.productName} account`,
    headline: "Approve your new email",
    greetingName: firstName(props.name),
    body: [
      [
        `Someone signed in to your ${theme.productName} account and asked to change its email to `,
        { strong: props.newEmail },
        ". If that was you, approve it here. We then send a confirmation link to the new address, and the change happens when that link is used. This link works for one hour.",
      ],
    ],
    cta: { label: "Approve the change", href: props.url, showUrl: true },
    after: [
      [
        "Didn't ask for this? Don't use the link. Your email stays as it is. Change your password, since whoever asked knew it.",
      ],
    ],
    reason: `Sent to the current email of a ${theme.productName} account because a change of address was requested.`,
  };
}

export function ChangeEmailApproval(props: Themed<ChangeEmailApprovalProps>) {
  const theme = themeOf(props);
  return (
    <Email content={changeEmailApprovalContent(props, theme)} theme={theme} />
  );
}

ChangeEmailApproval.PreviewProps = {
  name: "Adaeze Okafor",
  newEmail: "adaeze@kolalogistics.test",
  url: "https://app.example.com/api/auth/verify-email?token=preview-token&callbackURL=%2Fapp%2Faccount",
} satisfies ChangeEmailApprovalProps;
