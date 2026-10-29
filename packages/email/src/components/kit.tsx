import { CURRENCY_SYMBOL, isCurrency } from "@workspace/billing/money";
import type { CSSProperties, ReactNode } from "react";
import { Body, Head, Html, Img, Link, Preview } from "react-email";

import { emailIconFile } from "../assets";
import type { IconName, Inline, Paragraph, Tone } from "../content";
import { formatMoney } from "../format";
import type { EmailColors, EmailTheme } from "../theme";

type Role = keyof EmailColors;

/**
 * Inline light colours plus a class per role. The `<style>` block swaps the
 * class to the dark value in clients that honour `prefers-color-scheme`
 * (Apple Mail, iOS Mail, Outlook for Mac) and in Outlook.com
 * (`[data-ogsc]` for text, `[data-ogsb]` for backgrounds). Clients that
 * strip `<style>` keep the inline light design, which Gmail's apps then
 * invert on their own.
 */
export function sx(
  theme: EmailTheme,
  roles: { color?: Role; bg?: Role; border?: Role },
  style: CSSProperties = {},
  extraClass?: string
): { className: string; style: CSSProperties } {
  const c = theme.colors;
  const classes: string[] = [];
  const out: CSSProperties = {};
  if (roles.color) {
    out.color = c[roles.color];
    classes.push(`c-${roles.color}`);
  }
  if (roles.bg) {
    out.backgroundColor = c[roles.bg];
    classes.push(`bg-${roles.bg}`);
  }
  if (roles.border) {
    out.borderColor = c[roles.border];
    classes.push(`bd-${roles.border}`);
  }
  if (extraClass) {
    classes.push(extraClass);
  }
  return { className: classes.join(" "), style: { ...out, ...style } };
}

function colorSchemeCss(theme: EmailTheme): string {
  const roles = Object.keys(theme.colors) as Role[];
  const changed = roles.filter((r) => theme.colors[r] !== theme.dark[r]);
  const d = theme.dark;
  const text = changed.map((r) => `.c-${r}{color:${d[r]}!important}`);
  const bg = changed.map((r) => `.bg-${r}{background-color:${d[r]}!important}`);
  const border = changed.map((r) => `.bd-${r}{border-color:${d[r]}!important}`);
  const prefix = (p: string, rules: string[]) =>
    rules.map((rule) => `${p} ${rule}`).join("");
  return [
    ":root{color-scheme:light dark;supported-color-schemes:light dark}",
    `@media (prefers-color-scheme:dark){${[...text, ...bg, ...border].join("")}.mark{background-color:${theme.panel.tile}!important}}`,
    prefix("[data-ogsc]", [...text, ...border]),
    prefix("[data-ogsb]", bg),
  ].join("");
}

/** Geist for clients that load web fonts, plus a 1.6 KB Inter subset that
 *  supplies only ₦ and ₵ (Geist has neither), tuned to Geist's cap height
 *  and line metrics exactly as in apps/web/src/app/layout.tsx. */
function fontCss(theme: EmailTheme): string {
  if (!theme.assetsUrl) {
    return "";
  }
  const base = theme.assetsUrl.replace(/\/+$/, "");
  return [
    `@font-face{font-family:'Geist';src:url(${base}/fonts/geist-latin.woff2) format('woff2');font-weight:100 900;font-style:normal}`,
    `@font-face{font-family:'Geist Mono';src:url(${base}/fonts/geist-mono-latin.woff2) format('woff2');font-weight:100 900;font-style:normal}`,
    `@font-face{font-family:'Currency Symbols';src:url(${base}/fonts/currency-symbols.woff2) format('woff2');font-weight:100 900;unicode-range:U+20A6,U+20B5;size-adjust:97.6%;ascent-override:103%;descent-override:30.2%;line-gap-override:0%}`,
  ].join("");
}

const BASE_CSS = [
  "body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}",
  "table{border-collapse:collapse}",
  "a{text-decoration-thickness:1px;text-underline-offset:2px}",
  ".num{font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1}",
  // Long references stack under their label on phones instead of wrapping
  // mid-string in a narrow right-aligned column (see StackedRow).
  "@media only screen and (max-width:520px){.dt-only{display:none!important}.mb-only{display:table-row!important}}",
].join("");

/** The HTML document shell: head, colour-scheme CSS, preview line. */
export function Document({
  theme,
  preview,
  css,
  bodyRole,
  children,
}: {
  theme: EmailTheme;
  preview: string;
  /** Layout rules (mobile padding and the like). */
  css: string;
  bodyRole: Role;
  children: ReactNode;
}) {
  return (
    <Html dir="ltr" lang="en">
      <Head>
        <meta content="light dark" name="color-scheme" />
        <meta content="light dark" name="supported-color-schemes" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta
          content="telephone=no,date=no,address=no,email=no,url=no"
          name="format-detection"
        />
        <style>{fontCss(theme) + BASE_CSS + colorSchemeCss(theme) + css}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body
        {...sx(
          theme,
          { bg: bodyRole },
          {
            fontFamily: theme.fontFamily,
            margin: 0,
            padding: 0,
            WebkitFontSmoothing: "antialiased",
          },
          // Gmail keeps this class when it rewrites <body>; see urgentFallbackCss.
          "body"
        )}
      >
        {children}
      </Body>
    </Html>
  );
}

/** Outlook for Windows ignores @font-face but still tries the first family,
 *  then falls back to Times New Roman. This pins it to Arial and Consolas. */
export const msoHead = (urgentCss: string) =>
  `<!--[if mso]><style>body,table,td,th,p,a,span,h1,h2{font-family:Arial,Helvetica,sans-serif!important}.mono{font-family:Consolas,monospace!important}.f-urgent{${urgentCss}}</style><![endif]-->`;

export type MoneyParts = {
  sign: string;
  symbol: string;
  whole: string;
  cents: string;
  full: string;
};

/** Splits the shared formatter's output so the hero can set the symbol and
 *  decimals apart from the figure. Built from `formatMoney`, so the parts
 *  always join back to exactly what the app prints. */
export function moneyParts(subunit: number, currency: string): MoneyParts {
  const full = formatMoney(subunit, currency);
  const sign = subunit < 0 ? "−" : "";
  const symbol = isCurrency(currency)
    ? CURRENCY_SYMBOL[currency]
    : `${currency} `;
  const rest = full.slice(sign.length + symbol.length);
  const [whole = rest, cents = "00"] = rest.split(".");
  return { sign, symbol, whole, cents, full };
}

const MONTHS =
  "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December";
const DATE = new RegExp(`\\b(\\d{1,2}) (${MONTHS})\\b( \\d{4})?`, "g");

/** Glues "12 November 2026" with no-break spaces so a date never wraps
 *  across lines. Render-time only: the plain text keeps normal spaces. */
export function glue(text: string): string {
  return text.replace(
    DATE,
    (_m, d, mo, y) => `${d}\u00a0${mo}${y ? `\u00a0${y.trim()}` : ""}`
  );
}

const NUMERIC: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export function InlineText({
  theme,
  parts,
  strongRole = "text",
  linkRole = "link",
  onPanel = false,
}: {
  theme: EmailTheme;
  parts: Paragraph;
  strongRole?: Role;
  linkRole?: Role;
  onPanel?: boolean;
}) {
  const strongProps = (style: CSSProperties = {}) =>
    onPanel
      ? { style: { color: theme.panel.text, ...style } }
      : sx(theme, { color: strongRole }, style);
  return (
    <>
      {parts.map((part: Inline, i) => {
        const key = `${i}`;
        if (typeof part === "string") {
          return <span key={key}>{glue(part)}</span>;
        }
        if ("strong" in part) {
          return (
            <strong key={key} {...strongProps({ fontWeight: 600 })}>
              {glue(part.strong)}
            </strong>
          );
        }
        if ("money" in part) {
          return (
            <strong
              key={key}
              {...strongProps({ fontWeight: 600, ...NUMERIC })}
              className={`num ${onPanel ? "" : `c-${strongRole}`}`.trim()}
            >
              {part.money}
            </strong>
          );
        }
        return (
          <Link
            key={key}
            href={part.href}
            {...(onPanel
              ? {
                  style: {
                    color: theme.panel.text,
                    textDecoration: "underline",
                  },
                }
              : sx(
                  theme,
                  { color: linkRole },
                  { textDecoration: "underline" }
                ))}
          >
            {part.link}
          </Link>
        );
      })}
    </>
  );
}

/** Initials for the wordmark tile: "Turbo Start" → "TS". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`
      : name.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * The brand mark: the logo if one is configured, otherwise a small forest
 * tile with initials (the app's org chip) and the product name. Text, not an
 * image, so it survives images-off and keeps its colour under inversion.
 */
export function BrandMark({
  theme,
  size = 28,
  nameStyle,
}: {
  theme: EmailTheme;
  size?: number;
  nameStyle?: CSSProperties;
}) {
  if (theme.logoUrl) {
    return (
      <Img
        alt={theme.productName}
        height={String(size)}
        src={theme.logoUrl}
        style={{ display: "block", height: `${size}px`, width: "auto" }}
      />
    );
  }
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      data-skip-in-text="true"
      role="presentation"
      style={{ borderCollapse: "separate" }}
    >
      <tbody>
        <tr>
          <td
            align="center"
            className="mark"
            style={{
              backgroundColor: theme.panel.panel,
              borderRadius: `${Math.round(size / 3.5)}px`,
              color: theme.panel.text,
              fontSize: `${Math.round(size * 0.39)}px`,
              fontWeight: 700,
              height: `${size}px`,
              letterSpacing: "0.02em",
              lineHeight: `${size}px`,
              textAlign: "center",
              width: `${size}px`,
            }}
          >
            {initials(theme.productName)}
          </td>
          <td
            {...sx(
              theme,
              { color: "text" },
              {
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                lineHeight: `${size}px`,
                paddingLeft: "10px",
                whiteSpace: "nowrap",
                ...nameStyle,
              }
            )}
          >
            {theme.productName}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function toneColor(tone: Tone): Role {
  return tone === "quiet" ? "muted" : tone;
}

/** Status icon: a 2x PNG of the Lucide icon in the panel's tone colour.
 *  Decorative (empty alt): the word next to it carries the meaning, so
 *  images-off and screen readers lose nothing. */
export function iconUrl(
  theme: EmailTheme,
  icon: IconName,
  tone: Tone
): string | null {
  if (!theme.assetsUrl) {
    return null;
  }
  return `${theme.assetsUrl.replace(/\/+$/, "")}/${emailIconFile(icon, tone)}`;
}

export const presentation = {
  cellPadding: 0,
  cellSpacing: 0,
  role: "presentation",
  border: 0,
} as const;

/**
 * The phone version of a details row with a long monospace value (a Paystack
 * reference): label above, value below, full width. Table cells can't be
 * restacked with CSS once they share a column with other rows, so this row
 * is rendered next to the side-by-side one and swapped in by the media
 * query. Hidden by default, and from Outlook for Windows with mso-hide.
 */
export function StackedRow({
  theme,
  row,
  borderTop,
  padding,
  labelSize = "14px",
  valueSize = "13px",
}: {
  theme: EmailTheme;
  row: { label: string; value: string };
  borderTop: string;
  padding: string;
  labelSize?: string;
  valueSize?: string;
}) {
  return (
    <tr
      className="mb-only"
      style={{ display: "none", msoHide: "all" } as CSSProperties}
    >
      <td
        colSpan={2}
        {...sx(theme, { border: "rule" }, { borderTop, padding })}
      >
        <p
          {...sx(
            theme,
            { color: "muted" },
            { fontSize: labelSize, lineHeight: "20px", margin: 0 }
          )}
        >
          {row.label}
        </p>
        <p
          {...sx(
            theme,
            { color: "text" },
            {
              fontFamily: theme.monoFamily,
              fontSize: valueSize,
              fontWeight: 500,
              lineHeight: "20px",
              margin: "2px 0 0",
              wordBreak: "break-all",
            },
            "mono"
          )}
        >
          {row.value}
        </p>
      </td>
    </tr>
  );
}
