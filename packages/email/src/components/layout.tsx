import type { ReactNode } from "react";
import {
  Body,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";

import type { EmailTheme } from "../theme";

/**
 * Class-based overrides for clients that support <style>: dark mode (Apple
 * Mail, iOS Mail, Outlook.com via [data-ogsc]/[data-ogsb]) and a narrower
 * card on phones. Everything else is inline, so clients that strip <style>
 * (some Gmail views) still get the light design.
 */
function headCss(theme: EmailTheme): string {
  const d = theme.dark;
  const rules = (prefix: string) =>
    [
      `${prefix}.em-canvas{background-color:${d.canvas}!important}`,
      `${prefix}.em-surface{background-color:${d.surface}!important;border-color:${d.border}!important}`,
      `${prefix}.em-heading{color:${d.heading}!important}`,
      `${prefix}.em-text{color:${d.text}!important}`,
      `${prefix}.em-muted{color:${d.muted}!important}`,
      `${prefix}.em-link{color:${d.heading}!important}`,
      `${prefix}.em-button{background-color:${d.brand}!important;color:${d.brandText}!important}`,
      `${prefix}.em-button span{color:${d.brandText}!important}`,
      `${prefix}.em-subtle{background-color:${d.subtle}!important;border-color:${d.border}!important}`,
      `${prefix}.em-divider{border-color:${d.border}!important}`,
      `${prefix}.em-warning{border-left-color:${d.warning}!important}`,
      `${prefix}.em-logo-light{display:none!important}`,
      `${prefix}.em-wordmark{color:${d.heading}!important}`,
    ].join("");
  return [
    ":root{color-scheme:light dark;supported-color-schemes:light dark}",
    `@media (prefers-color-scheme:dark){${rules("")}}`,
    rules("[data-ogsc] "),
    "@media only screen and (max-width:600px){",
    ".em-pad{padding:28px 22px!important}",
    ".em-outer{padding:24px 12px!important}",
    ".em-cell{padding:10px 14px!important}",
    "}",
  ].join("");
}

export type LayoutProps = {
  theme: EmailTheme;
  /** Inbox preview line (hidden in the body). */
  preview: string;
  /** Why the recipient got this, shown in the footer. */
  reason: string;
  children: ReactNode;
};

export function Layout({ theme, preview, reason, children }: LayoutProps) {
  const c = theme.colors;
  return (
    <Html dir="ltr" lang="en">
      <Head>
        <meta content="light dark" name="color-scheme" />
        <meta content="light dark" name="supported-color-schemes" />
        <style>{headCss(theme)}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        className="em-canvas"
        style={{
          backgroundColor: c.canvas,
          fontFamily: theme.fontFamily,
          margin: 0,
          padding: 0,
          WebkitTextSizeAdjust: "100%",
        }}
      >
        <Section className="em-canvas" style={{ backgroundColor: c.canvas }}>
          <Container
            style={{ maxWidth: "600px", padding: "40px 20px" }}
            tdClassName="em-outer"
          >
            <Brand theme={theme} />
            <Section
              className="em-surface"
              style={{
                backgroundColor: c.surface,
                border: `1px solid ${c.border}`,
                borderRadius: "12px",
                borderCollapse: "separate",
              }}
            >
              <Row>
                <Column className="em-pad" style={{ padding: "40px 44px" }}>
                  {children}
                </Column>
              </Row>
            </Section>
            <Footer reason={reason} theme={theme} />
          </Container>
        </Section>
      </Body>
    </Html>
  );
}

function Brand({ theme }: { theme: EmailTheme }) {
  return (
    <Section data-skip-in-text="true" style={{ padding: "0 4px 24px" }}>
      {theme.logoUrl ? (
        <Img
          alt={theme.productName}
          height="28"
          src={theme.logoUrl}
          style={{ display: "block", height: "28px", width: "auto" }}
        />
      ) : (
        <Text
          className="em-wordmark"
          style={{
            color: theme.colors.heading,
            fontSize: "17px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
            lineHeight: "28px",
            margin: 0,
          }}
        >
          {theme.productName}
        </Text>
      )}
    </Section>
  );
}

function Footer({ reason, theme }: { reason: string; theme: EmailTheme }) {
  const style = {
    color: theme.colors.muted,
    fontSize: "12px",
    lineHeight: "18px",
    margin: "0 0 6px",
  };
  return (
    <Section style={{ padding: "24px 4px 0" }}>
      <Text className="em-muted" style={style}>
        {reason}
      </Text>
      <Text className="em-muted" style={{ ...style, margin: 0 }}>
        {theme.productName}
        {theme.supportUrl ? (
          <>
            {" · "}
            <Link
              className="em-muted"
              href={theme.supportUrl}
              style={{ color: theme.colors.muted, textDecoration: "underline" }}
            >
              Contact support
            </Link>
          </>
        ) : null}
      </Text>
    </Section>
  );
}
