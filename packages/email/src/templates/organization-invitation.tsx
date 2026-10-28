import { Layout } from "../components/layout";
import {
  Button,
  DetailTable,
  Heading,
  Strong,
  Text,
} from "../components/primitives";
import { oneLine } from "../links";
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

export function OrganizationInvitation(
  props: Themed<OrganizationInvitationProps>
) {
  const theme = themeOf(props);
  return (
    <Layout
      preview={`Join ${props.organizationName} on ${theme.productName}.`}
      reason={`This invitation was sent to ${props.recipientEmail}. If you weren't expecting it, you can ignore this email.`}
      theme={theme}
    >
      <Heading theme={theme}>Join {props.organizationName}</Heading>
      <Text theme={theme}>
        <Strong theme={theme}>{props.inviterName}</Strong> ({props.inviterEmail}
        ) invited you to join{" "}
        <Strong theme={theme}>{props.organizationName}</Strong> on{" "}
        {theme.productName}.
      </Text>
      <DetailTable
        theme={theme}
        rows={[
          { label: "Organization", value: props.organizationName },
          { label: "Role", value: roleLabel(props.role) },
          {
            label: "Expires",
            value: `In ${props.expiresInDays} days`,
          },
        ]}
      />
      <Button theme={theme} href={props.acceptUrl}>
        Accept invitation
      </Button>
      <Text theme={theme} muted small style={{ margin: 0 }}>
        The invitation only works for {props.recipientEmail}, and that address
        must be verified. It can be used once.
      </Text>
    </Layout>
  );
}

OrganizationInvitation.PreviewProps = {
  inviterName: "Tunde Bakare",
  inviterEmail: "tunde@acme.ng",
  organizationName: "Acme Logistics",
  role: "admin",
  recipientEmail: "ada@acme.ng",
  acceptUrl: "https://app.example.com/accept-invite/inv_9f2c41d7",
  expiresInDays: 7,
} satisfies OrganizationInvitationProps;
