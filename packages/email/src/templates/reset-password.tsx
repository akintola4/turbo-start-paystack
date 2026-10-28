import { Layout } from "../components/layout";
import { Button, Heading, Text } from "../components/primitives";
import { type Themed, themeOf } from "./shared";

export type ResetPasswordProps = { name?: string; url: string };

export const resetPasswordSubject = (_props: ResetPasswordProps) =>
  "Reset your password";

export function ResetPassword(props: Themed<ResetPasswordProps>) {
  const theme = themeOf(props);
  return (
    <Layout
      preview={`Choose a new password for your ${theme.productName} account.`}
      reason="You're receiving this because a password reset was requested for this address. If you didn't ask for one, ignore this email; your password won't change."
      theme={theme}
    >
      <Heading theme={theme}>Reset your password</Heading>
      <Text theme={theme}>
        {props.name ? `Hi ${props.name}, we` : "We"} received a request to reset
        the password for your {theme.productName} account. The link works once
        and expires in an hour.
      </Text>
      <Button theme={theme} href={props.url} last>
        Choose a new password
      </Button>
    </Layout>
  );
}

ResetPassword.PreviewProps = {
  name: "Ada Okafor",
  url: "https://app.example.com/api/auth/reset-password/preview-token?callbackURL=%2Freset-password",
} satisfies ResetPasswordProps;
