import type { CSSProperties, ReactNode } from "react";
import {
  Column,
  Button as EmailButton,
  Heading as EmailHeading,
  Text as EmailText,
  Link,
  Row,
  Section,
} from "react-email";

import type { EmailTheme } from "../theme";

export function Heading({
  theme,
  children,
}: {
  theme: EmailTheme;
  children: ReactNode;
}) {
  return (
    <EmailHeading
      as="h1"
      className="em-heading"
      style={{
        color: theme.colors.heading,
        fontSize: "22px",
        fontWeight: 600,
        letterSpacing: "-0.01em",
        lineHeight: "30px",
        margin: "0 0 16px",
      }}
    >
      {children}
    </EmailHeading>
  );
}

export function Text({
  theme,
  children,
  muted = false,
  small = false,
  style,
}: {
  theme: EmailTheme;
  children: ReactNode;
  muted?: boolean;
  small?: boolean;
  style?: CSSProperties;
}) {
  return (
    <EmailText
      className={muted ? "em-muted" : "em-text"}
      style={{
        color: muted ? theme.colors.muted : theme.colors.text,
        fontSize: small ? "13px" : "15px",
        lineHeight: small ? "20px" : "24px",
        margin: "0 0 16px",
        ...style,
      }}
    >
      {children}
    </EmailText>
  );
}

export function Strong({
  theme,
  children,
}: {
  theme: EmailTheme;
  children: ReactNode;
}) {
  return (
    <strong className="em-heading" style={{ color: theme.colors.heading }}>
      {children}
    </strong>
  );
}

/** Primary call to action, followed by the raw link for clients that block
 *  buttons or for copying. */
export function Button({
  theme,
  href,
  children,
  fallback = true,
  last = false,
}: {
  theme: EmailTheme;
  href: string;
  children: ReactNode;
  fallback?: boolean;
  /** Last element in the card: no bottom margin. */
  last?: boolean;
}) {
  return (
    <>
      <Section style={{ margin: last && !fallback ? "8px 0 0" : "8px 0 24px" }}>
        <EmailButton
          className="em-button"
          href={href}
          style={{
            backgroundColor: theme.colors.brand,
            borderRadius: "8px",
            color: theme.colors.brandText,
            fontSize: "15px",
            fontWeight: 600,
            padding: "13px 22px",
          }}
        >
          {children}
        </EmailButton>
      </Section>
      {fallback ? (
        <Section data-skip-in-text="true">
          <Text
            muted
            small
            theme={theme}
            style={last ? { margin: 0 } : undefined}
          >
            If the button doesn't work, copy this link into your browser:
            <br />
            <Link
              className="em-link"
              href={href}
              style={{
                color: theme.colors.heading,
                textDecoration: "underline",
                wordBreak: "break-all",
              }}
            >
              {href}
            </Link>
          </Text>
        </Section>
      ) : null}
    </>
  );
}

export type Detail = { label: string; value: ReactNode };

/** Label/value rows, e.g. plan, amount, reference on a receipt. */
export function DetailTable({
  theme,
  rows,
}: {
  theme: EmailTheme;
  rows: Detail[];
}) {
  return (
    <Section
      className="em-subtle"
      style={{
        backgroundColor: theme.colors.subtle,
        borderRadius: "8px",
        margin: "4px 0 24px",
      }}
    >
      {rows.map((row, index) => (
        <Row key={row.label}>
          <Column
            className="em-label em-cell em-muted em-divider"
            style={{
              borderTop:
                index === 0 ? "none" : `1px solid ${theme.colors.border}`,
              color: theme.colors.muted,
              fontSize: "14px",
              lineHeight: "20px",
              padding: "11px 16px",
              verticalAlign: "top",
              // Labels are short; let them size to content so values get the
              // room (references, date ranges).
              whiteSpace: "nowrap",
            }}
          >
            {row.label}
          </Column>
          <Column
            align="right"
            className="em-cell em-heading em-divider"
            style={{
              borderTop:
                index === 0 ? "none" : `1px solid ${theme.colors.border}`,
              color: theme.colors.heading,
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: "20px",
              padding: "11px 16px",
              textAlign: "right",
              verticalAlign: "top",
              width: "100%",
              wordBreak: "break-word",
            }}
          >
            {row.value}
          </Column>
        </Row>
      ))}
    </Section>
  );
}

/** Highlighted note, e.g. the grace-period deadline on a failed payment. */
export function Callout({
  theme,
  children,
}: {
  theme: EmailTheme;
  children: ReactNode;
}) {
  return (
    <Section
      className="em-subtle em-warning"
      style={{
        backgroundColor: theme.colors.subtle,
        borderLeft: `3px solid ${theme.colors.warning}`,
        borderRadius: "6px",
        margin: "4px 0 24px",
      }}
    >
      <Row>
        <Column
          className="em-text"
          style={{
            color: theme.colors.text,
            fontSize: "14px",
            lineHeight: "22px",
            padding: "12px 16px",
          }}
        >
          {children}
        </Column>
      </Row>
    </Section>
  );
}
