import type { CSSProperties, ReactNode } from "react";
import { Button, Img, Link } from "react-email";

import type { DetailRow, EmailContent, Hero, Status } from "../content";
import type { EmailTheme } from "../theme";
import {
  BrandMark,
  Document,
  glue,
  InlineText,
  iconUrl,
  moneyParts,
  presentation,
  StackedRow,
  sx,
  toneColor,
} from "./kit";

/**
 * The "Forest card" layout: the app's billing panel, mailed.
 *
 * Billing emails open on the forest panel (the same in light and dark mode):
 * plan and status chip, the amount or deadline as the hero, up to two meta
 * tiles and the one action. The explanation and the details table sit on a
 * quiet card below. Account emails (verify, reset, invite) have no money or
 * plan state, so, as in the app, they skip the panel; their card repeats the
 * panel's rhythm (title row, large headline, the same button) so the family
 * still reads as one.
 *
 * Everything hangs off one left axis: the brand mark, the panel and card
 * content and the footer all start at the same 32px inset (20px on phones).
 */

const INSET = "32px";
const INSET_MOBILE = "20px";
/** The card has a 1px border, so its padding is 1px less to land on the
 *  same axis. */
const CARD_INSET = "31px";
const CARD_INSET_MOBILE = "19px";

/**
 * Gmail and Outlook for Windows invert colours they consider light, and a
 * sunflower button with a brown label comes out as a dull mustard with a
 * pale label. Neither inversion can be detected, but both clients can be:
 * Gmail rewrites <body> into `<u></u><div class="body">`, so `u + .body`
 * matches only there, and Outlook for Windows reads the mso block in
 * render.ts. In those two the urgent button becomes a dark tile with a
 * sunflower edge and label, which inversion leaves alone. Everywhere else it
 * stays solid sunflower.
 */
export function urgentFallbackCss(theme: EmailTheme): string {
  const p = theme.panel;
  return `background-color:${p.tile}!important;border-color:${theme.colors.accent}!important;color:${theme.colors.accent}!important`;
}

const CSS = (theme: EmailTheme) =>
  [
    `u + .body .f-urgent{${urgentFallbackCss(theme)}}`,
    "@media only screen and (max-width:520px){",
    ".f-outer{padding:20px 12px 32px!important}",
    `.f-inset{padding-left:${INSET_MOBILE}!important;padding-right:${INSET_MOBILE}!important}`,
    `.f-box{padding:24px ${INSET_MOBILE}!important}`,
    `.f-cardbox{padding:23px ${CARD_INSET_MOBILE}!important}`,
    ".f-panel{border-radius:24px!important}",
    ".f-hero{font-size:44px!important;line-height:48px!important}",
    ".f-date{font-size:34px!important;line-height:40px!important}",
    ".f-h1{font-size:26px!important;line-height:32px!important}",
    ".f-btn{display:block!important;text-align:center!important}",
    ".f-tile{display:block!important;width:auto!important;margin-bottom:8px!important}",
    ".f-tile:last-child{margin-bottom:0!important}",
    ".f-gap{display:none!important}",
    "}",
  ].join("");

export function Email({
  theme,
  content,
}: {
  theme: EmailTheme;
  content: EmailContent;
}) {
  const panel = content.billing;
  return (
    <Document
      bodyRole="canvas"
      css={CSS(theme)}
      preview={content.preview}
      theme={theme}
    >
      <table
        {...presentation}
        {...sx(theme, { bg: "canvas" }, { width: "100%" })}
      >
        <tbody>
          <tr>
            <td
              align="center"
              className="f-outer"
              style={{ padding: "32px 16px 48px" }}
            >
              <table
                {...presentation}
                style={{ maxWidth: "600px", width: "100%" }}
                width="600"
              >
                <tbody>
                  <tr>
                    <td
                      className="f-inset"
                      style={{ padding: `0 ${INSET} 20px` }}
                    >
                      <BrandMark theme={theme} />
                    </td>
                  </tr>
                  {panel ? (
                    <tr>
                      <td style={{ paddingBottom: "12px" }}>
                        <Panel content={content} theme={theme} />
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td>
                      <Card content={content} panel={panel} theme={theme} />
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <Footer content={content} theme={theme} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </Document>
  );
}

/** Stacks blocks with one gap between them and none after the last, so a
 *  box's bottom padding is exactly its padding. */
function Stack({ gap, children }: { gap: number; children: ReactNode[] }) {
  const blocks = children.filter(Boolean);
  return (
    <>
      {blocks.map((block, i) => (
        <div key={`s${i}`} style={{ marginTop: i === 0 ? 0 : `${gap}px` }}>
          {block}
        </div>
      ))}
    </>
  );
}

function Panel({
  theme,
  content,
}: {
  theme: EmailTheme;
  content: EmailContent;
}) {
  const p = theme.panel;
  const tiles = (content.details?.rows ?? []).filter((r) => r.tile).slice(0, 2);
  return (
    <table
      {...presentation}
      bgcolor={p.panel}
      className="f-panel"
      style={{
        backgroundColor: p.panel,
        borderCollapse: "separate",
        borderRadius: "32px",
        width: "100%",
      }}
    >
      <tbody>
        <tr>
          <td className="f-box" style={{ padding: `28px ${INSET} ${INSET}` }}>
            <Stack gap={24}>
              {[
                <TitleRow
                  key="title"
                  status={content.status}
                  theme={theme}
                  title={content.title}
                />,
                content.hero ? (
                  <PanelHero hero={content.hero} key="hero" theme={theme} />
                ) : (
                  // No figure to lead with (a dispute, an expiring card):
                  // the headline takes the hero's place so the panel says
                  // what happened instead of showing only a chip and a button.
                  <h1
                    className="f-h1"
                    key="headline"
                    style={{
                      color: theme.panel.text,
                      fontSize: "32px",
                      fontWeight: 600,
                      letterSpacing: "-0.025em",
                      lineHeight: "38px",
                      margin: 0,
                    }}
                  >
                    {content.headline}
                  </h1>
                ),
                tiles.length > 0 ? (
                  <Tiles key="tiles" rows={tiles} theme={theme} />
                ) : null,
                content.cta ? (
                  <PanelButton
                    href={content.cta.href}
                    key="cta"
                    label={content.cta.label}
                    theme={theme}
                    urgent={Boolean(content.cta.urgent)}
                  />
                ) : null,
              ]}
            </Stack>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function TitleRow({
  theme,
  title,
  status,
}: {
  theme: EmailTheme;
  title: string;
  status?: Status;
}) {
  return (
    <table {...presentation}>
      <tbody>
        <tr>
          <td
            style={{
              color: theme.panel.text,
              fontSize: "17px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              lineHeight: "24px",
              paddingRight: "10px",
              verticalAlign: "middle",
            }}
          >
            {title}
          </td>
          {status ? (
            <td style={{ verticalAlign: "middle" }}>
              <StatusChip status={status} theme={theme} />
            </td>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}

/**
 * The panel's action. By default it is the app's in-panel button: a darker
 * forest tile with an off-white label and a hairline edge. Gmail's apps and
 * Outlook for Windows invert light backgrounds and dark text but leave dark
 * backgrounds with light text alone, so this button looks the same in every
 * client (an off-white button turned dark grey there). The one money-moving
 * fix ("Update card") keeps sunflower, the app's "this one" colour.
 */
function PanelButton({
  theme,
  href,
  label,
  urgent,
}: {
  theme: EmailTheme;
  href: string;
  label: string;
  urgent: boolean;
}) {
  const p = theme.panel;
  const style: CSSProperties = urgent
    ? {
        backgroundColor: theme.colors.accent,
        border: `1px solid ${theme.colors.accent}`,
        color: theme.colors.onAccent,
      }
    : {
        backgroundColor: p.tile,
        border: `1px solid ${p.line}`,
        color: p.text,
      };
  return (
    <Button
      className={urgent ? "f-btn f-urgent" : "f-btn"}
      href={href}
      style={{
        ...style,
        borderRadius: "12px",
        fontSize: "15px",
        fontWeight: 600,
        lineHeight: "20px",
        padding: "11px 19px",
      }}
    >
      {label}
    </Button>
  );
}

function StatusChip({ theme, status }: { theme: EmailTheme; status: Status }) {
  const p = theme.panel;
  const icon = iconUrl(theme, status.icon, status.tone);
  return (
    <table {...presentation} style={{ borderCollapse: "separate" }}>
      <tbody>
        <tr>
          <td
            {...{ bgcolor: p.tile }}
            style={{
              backgroundColor: p.tile,
              borderRadius: "8px",
              color: p[status.tone],
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: "16px",
              padding: icon ? "4px 8px 4px 6px" : "4px 8px",
              whiteSpace: "nowrap",
            }}
          >
            {icon ? (
              <Img
                alt=""
                height="14"
                src={icon}
                style={{
                  display: "inline-block",
                  height: "14px",
                  marginRight: "5px",
                  verticalAlign: "-2px",
                  width: "14px",
                }}
                width="14"
              />
            ) : null}
            {status.label}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** The amount (or deadline) in the panel. The symbol sits on the figure's
 *  baseline at full size, as in the app; ".00" is dropped at display size
 *  and the exact amount is in the details. */
function PanelHero({ theme, hero }: { theme: EmailTheme; hero: Hero }) {
  const p = theme.panel;
  const caption = (
    <p
      style={{
        color: p.muted,
        fontSize: "15px",
        lineHeight: "22px",
        margin: "8px 0 0",
      }}
    >
      {glue(hero.caption)}
    </p>
  );
  const figure: CSSProperties = {
    color: p.text,
    fontWeight: 600,
    letterSpacing: "-0.025em",
    margin: 0,
  };
  if (hero.kind === "date") {
    return (
      <>
        <p
          className="f-date"
          style={{ ...figure, fontSize: "44px", lineHeight: "48px" }}
        >
          {glue(hero.text)}
        </p>
        {caption}
      </>
    );
  }
  const m = moneyParts(hero.amountSubunit, hero.currency);
  return (
    <>
      <p
        className="f-hero num"
        style={{
          ...figure,
          fontSize: "56px",
          fontVariantNumeric: "tabular-nums",
          lineHeight: "60px",
          whiteSpace: "nowrap",
        }}
      >
        {m.sign}
        {m.symbol}
        {m.whole}
        {m.cents === "00" ? null : (
          <span style={{ color: p.muted }}>.{m.cents}</span>
        )}
        {hero.unit ? (
          <span
            style={{
              color: p.muted,
              fontSize: "16px",
              fontWeight: 500,
              letterSpacing: 0,
              paddingLeft: "6px",
            }}
          >
            {hero.unit}
          </span>
        ) : null}
      </p>
      {caption}
    </>
  );
}

/**
 * Up to two facts from the details, as the app panel's meta tiles. A fixed
 * table layout splits the row evenly around an 8px gutter and gives both
 * tiles the row's height; below 520px they stack.
 */
function Tiles({ theme, rows }: { theme: EmailTheme; rows: DetailRow[] }) {
  const p = theme.panel;
  const tile = (row: DetailRow) => (
    <td
      {...{ bgcolor: p.tile }}
      className="f-tile"
      style={{
        backgroundColor: p.tile,
        borderRadius: "16px",
        padding: "14px 16px 15px",
        verticalAlign: "top",
      }}
    >
      <p
        style={{
          color: p.muted,
          fontSize: "13px",
          lineHeight: "18px",
          margin: 0,
        }}
      >
        {row.label}
      </p>
      <p
        className="num"
        style={{
          color: p.text,
          fontSize: "15px",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          lineHeight: "22px",
          margin: "4px 0 0",
        }}
      >
        {glue(row.value)}
      </p>
    </td>
  );
  const [first, second] = rows;
  return (
    <table
      {...presentation}
      style={{
        borderCollapse: "separate",
        tableLayout: "fixed",
        width: "100%",
      }}
    >
      <tbody>
        <tr>
          {first ? tile(first) : null}
          {second ? (
            <>
              <td
                className="f-gap"
                style={{ fontSize: 0, lineHeight: 0, width: "8px" }}
                width="8"
              >
                &nbsp;
              </td>
              {tile(second)}
            </>
          ) : null}
        </tr>
      </tbody>
    </table>
  );
}

function Card({
  theme,
  content,
  panel,
}: {
  theme: EmailTheme;
  content: EmailContent;
  panel: boolean;
}) {
  const text = (extra: CSSProperties = {}) =>
    sx(
      theme,
      { color: "text" },
      { fontSize: "15px", lineHeight: "24px", margin: 0, ...extra }
    );
  const small = sx(
    theme,
    { color: "muted" },
    { fontSize: "13px", lineHeight: "20px", margin: 0 }
  );
  const rows = (content.details?.rows ?? []).filter(
    (r) => !(panel && (r.isHero || r.tile))
  );
  const blocks: ReactNode[] = [];
  if (!panel) {
    // The panel's rhythm without the panel: title row, then a headline at
    // display size.
    blocks.push(
      <div key="head">
        <p
          {...sx(
            theme,
            { color: "muted" },
            {
              fontSize: "15px",
              fontWeight: 600,
              lineHeight: "24px",
              margin: 0,
            }
          )}
        >
          {content.title}
        </p>
        <h1
          {...sx(
            theme,
            { color: "text" },
            {
              fontSize: "32px",
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: "38px",
              margin: "10px 0 0",
            },
            "f-h1"
          )}
        >
          {content.headline}
        </h1>
      </div>
    );
  }
  if (content.greetingName) {
    blocks.push(
      <p key="hi" {...text()}>
        Hi {content.greetingName},
      </p>
    );
  }
  content.body.forEach((para, i) => {
    blocks.push(
      <p key={`b${i}`} {...text()}>
        <InlineText parts={para} theme={theme} />
      </p>
    );
  });
  if (content.callout) {
    blocks.push(
      <table
        key="callout"
        {...presentation}
        {...sx(
          theme,
          { bg: "well" },
          { borderCollapse: "separate", borderRadius: "16px", width: "100%" }
        )}
      >
        <tbody>
          <tr>
            <td {...text({ padding: "14px 18px" })}>
              <InlineText
                parts={content.callout.text}
                strongRole={toneColor(content.callout.tone)}
                theme={theme}
              />
            </td>
          </tr>
        </tbody>
      </table>
    );
  }
  if (rows.length > 0) {
    blocks.push(<DetailsTable key="details" rows={rows} theme={theme} />);
  }
  if (!panel && content.cta) {
    blocks.push(
      <div key="cta" style={{ paddingTop: "8px" }}>
        <Button
          href={content.cta.href}
          {...sx(
            theme,
            { bg: "brand", color: "brandText", border: "brand" },
            {
              border: `1px solid ${theme.colors.brand}`,
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 600,
              lineHeight: "20px",
              padding: "11px 19px",
            },
            "f-btn"
          )}
        >
          {content.cta.label}
        </Button>
      </div>
    );
    if (content.cta.showUrl) {
      blocks.push(
        <p key="url" {...small}>
          Or paste this link into your browser:
          <br />
          <Link
            href={content.cta.href}
            {...sx(
              theme,
              { color: "link" },
              { textDecoration: "underline", wordBreak: "break-all" }
            )}
          >
            {content.cta.href}
          </Link>
        </p>
      );
    }
  }
  (content.after ?? []).forEach((para, i) => {
    blocks.push(
      <p key={`a${i}`} {...small}>
        <InlineText linkRole="muted" parts={para} theme={theme} />
      </p>
    );
  });
  return (
    <table
      {...presentation}
      {...sx(
        theme,
        { bg: "surface", border: "rule" },
        {
          border: `1px solid ${theme.colors.rule}`,
          borderCollapse: "separate",
          borderRadius: "24px",
          width: "100%",
        }
      )}
    >
      <tbody>
        <tr>
          <td
            className="f-cardbox"
            style={{
              padding: `${panel ? "23px" : "27px"} ${CARD_INSET} ${CARD_INSET}`,
            }}
          >
            <Stack gap={16}>{blocks}</Stack>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function DetailsTable({
  theme,
  rows,
}: {
  theme: EmailTheme;
  rows: DetailRow[];
}) {
  return (
    <table {...presentation} style={{ width: "100%" }}>
      <tbody>
        {rows.map((row, i) => (
          <DetailLine
            first={i === 0}
            key={row.label}
            last={i === rows.length - 1}
            row={row}
            theme={theme}
          />
        ))}
      </tbody>
    </table>
  );
}

/** One label/value row. Labels and values share a 20px line so their
 *  baselines match; values are right-aligned with tabular figures so
 *  amounts line up on the decimal point. */
function DetailLine({
  theme,
  row,
  first,
  last,
}: {
  theme: EmailTheme;
  row: DetailRow;
  first: boolean;
  last: boolean;
}) {
  const borderTop = first ? "none" : `1px solid ${theme.colors.rule}`;
  const padding = `${first ? "4px" : "11px"} 0 ${last ? "0" : "11px"}`;
  const mono = Boolean(row.mono);
  return (
    <>
      <tr className={mono ? "dt-only" : undefined}>
        <td
          {...sx(
            theme,
            { color: "muted", border: "rule" },
            {
              borderTop,
              fontSize: "14px",
              lineHeight: "20px",
              padding,
              paddingRight: "16px",
              verticalAlign: "top",
              whiteSpace: "nowrap",
            }
          )}
        >
          {row.label}
        </td>
        <td
          align="right"
          {...sx(
            theme,
            { color: "text", border: "rule" },
            {
              borderTop,
              fontFamily: mono ? theme.monoFamily : undefined,
              fontSize: mono ? "13px" : "14px",
              fontVariantNumeric: "tabular-nums",
              fontWeight: 500,
              lineHeight: "20px",
              padding,
              textAlign: "right",
              verticalAlign: "top",
              whiteSpace: row.money ? "nowrap" : undefined,
              width: "100%",
              wordBreak: mono ? "break-all" : "break-word",
            },
            mono ? "mono num" : "num"
          )}
        >
          {row.value}
        </td>
      </tr>
      {mono ? (
        <StackedRow
          borderTop={borderTop}
          padding={padding}
          row={row}
          theme={theme}
        />
      ) : null}
    </>
  );
}

function Footer({
  theme,
  content,
}: {
  theme: EmailTheme;
  content: EmailContent;
}) {
  const style = (extra: CSSProperties = {}) =>
    sx(
      theme,
      { color: "muted" },
      { fontSize: "12.5px", lineHeight: "19px", margin: 0, ...extra }
    );
  return (
    <div className="f-inset" style={{ padding: `20px ${INSET} 0` }}>
      <p {...style({ marginBottom: "6px" })}>{content.reason}</p>
      <p {...style()}>
        {theme.productName}
        {theme.supportUrl ? (
          <>
            <span style={{ padding: "0 6px" }}>/</span>
            <Link
              href={theme.supportUrl}
              {...sx(
                theme,
                { color: "muted" },
                { textDecoration: "underline" }
              )}
            >
              Contact support
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
