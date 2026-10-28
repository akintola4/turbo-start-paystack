import { Layout } from "../components/layout";
import { Button, Heading, Text } from "../components/primitives";
import { type Themed, themeOf } from "./shared";

export type VerifyEmailProps = {
  /** The account's display name; omitted from the greeting when empty. */
  name?: string;
  url: string;
};

export const verifyEmailSubject = (_props: VerifyEmailProps) =>
  "Verify your email address";

export function VerifyEmail(props: Themed<VerifyEmailProps>) {
  const theme = themeOf(props);
  return (
    <Layout
      preview={`Confirm your email to finish setting up ${theme.productName}.`}
      reason={`You're receiving this because this address was used to sign up for ${theme.productName}. If that wasn't you, you can ignore this email.`}
      theme={theme}
    >
      <Heading theme={theme}>Verify your email</Heading>
      <Text theme={theme}>
        {props.name ? `Hi ${props.name}, thanks` : "Thanks"} for signing up for{" "}
        {theme.productName}. Confirm this is your email address to finish
        setting up your account.
      </Text>
      <Button theme={theme} href={props.url} last>
        Verify email address
      </Button>
    </Layout>
  );
}

VerifyEmail.PreviewProps = {
  name: "Ada Okafor",
  url: "https://app.example.com/api/auth/verify-email?token=preview-token&callbackURL=%2Fapp",
} satisfies VerifyEmailProps;
