import { type EmailContent, strong } from "../content";
import { Email } from "../components/email";
import { oneLine } from "../links";
import type { EmailTheme } from "../theme";
import { type Themed, themeOf } from "./shared";

export type OrganizationInvitationProps = {
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  role: string;
  recipientEmail: string;
  acceptUrl: string;
  expiresInDays: number;
};

export const organizationInvitationSubject = (p: OrganizationInvitationProps) =>
  oneLine(`${p.inviterName} invited you to ${p.organizationName}`);

const roleLabel = (role: string) =>
  role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.charAt(0).toUpperCase() + r.slice(1))
    .join(", ");

export function organizationInvitationContent(
  props: OrganizationInvitationProps,
  theme: EmailTheme
): EmailContent {
  const role = roleLabel(props.role);
  return {
    billing: false,
    preview: `${props.inviterName} added you to ${props.organizationName} as ${role}.`,
    title: "Invitation",
    headline: `Join ${props.organizationName}`,
    body: [
      [
        strong(props.inviterName),
        ` (${props.inviterEmail}) invited you to `,
        strong(props.organizationName),
        ` on ${theme.productName}, with the ${role} role.`,
      ],
    ],
    details: {
      title: "Invitation",
      rows: [
        { label: "Organization", value: props.organizationName },
        { label: "Role", value: role },
        { label: "Invited by", value: props.inviterName },
        {
          label: "Expires",
          value: `In ${props.expiresInDays} day${props.expiresInDays === 1 ? "" : "s"}`,
        },
      ],
    },
    cta: { label: "Accept invitation", href: props.acceptUrl, showUrl: true },
    after: [
      [
        `It only works for ${props.recipientEmail}, once that address is verified, and it can be used once.`,
      ],
    ],
    reason: `Sent to ${props.recipientEmail}. Not expecting an invitation? Ignore this email.`,
  };
}

export function OrganizationInvitation(
  props: Themed<OrganizationInvitationProps>
) {
  const theme = themeOf(props);
  return (
    <Email
      content={organizationInvitationContent(props, theme)}
      theme={theme}
    />
  );
}

OrganizationInvitation.PreviewProps = {
  inviterName: "Tunde Bakare",
  inviterEmail: "tunde@kolalogistics.ng",
  organizationName: "Kola Logistics",
  role: "admin",
  recipientEmail: "adaeze@kolalogistics.ng",
  acceptUrl: "https://app.example.com/accept-invite/inv_9f2c41d7",
  expiresInDays: 7,
} satisfies OrganizationInvitationProps;
