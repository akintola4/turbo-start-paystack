/**
 * What an email says, independent of how it looks. Each template turns its
 * props into an `EmailContent`; the layout in components/email.tsx renders
 * it, and the plain-text part is written from it directly, so the HTML and
 * text versions can't drift apart.
 */

/** Inline text: plain strings, bold runs, links and amounts. User-supplied
 *  strings only ever land in `string` positions, which React escapes. */
export type Inline =
  | string
  | { strong: string }
  | { link: string; href: string }
  | { money: string };

export type Paragraph = Inline[];

export const TONES = ["success", "warning", "danger", "info", "quiet"] as const;
export type Tone = (typeof TONES)[number];

/** Lucide names; each has a PNG per tone in apps/web/public/email/icons. */
export const ICONS = [
  "circle-check",
  "triangle-alert",
  "circle-x",
  "hourglass",
  "calendar-x",
  "credit-card",
  "arrow-up-right",
  "arrow-down-right",
] as const;
export type IconName = (typeof ICONS)[number];

export type Status = { tone: Tone; label: string; icon: IconName };

export type Hero =
  | {
      kind: "money";
      amountSubunit: number;
      currency: string;
      /** e.g. "/ month" next to the figure. */
      unit?: string;
      caption: string;
    }
  | { kind: "date"; text: string; caption: string };

export type DetailRow = {
  label: string;
  value: string;
  /** Paystack references: monospace, breakable. */
  mono?: boolean;
  /** Money: tabular and never wrapped. */
  money?: boolean;
  /** Already shown as the hero; the forest card leaves it out. */
  isHero?: boolean;
  /** The forest card lifts this row into a tile on the panel (and drops it
   *  from the table), as the app's billing panel does. At most two. */
  tile?: boolean;
};

export type EmailContent = {
  /** Inbox preview line. */
  preview: string;
  /** Billing emails are about money or plan state and get the forest panel. */
  billing: boolean;
  status?: Status;
  /** First name, for "Hi Adaeze". */
  greetingName?: string;
  /** What the email is about ("Pro plan", "Turbo Start account"): the
   *  panel heading, or the small label above an account email's headline. */
  title: string;
  /** What happened, as a sentence ("Payment received"): the headline of
   *  account emails and the plain text's first line. */
  headline: string;
  hero?: Hero;
  body: Paragraph[];
  /** A deadline or consequence that must not be missed. */
  callout?: { tone: Tone; text: Paragraph };
  details?: { title: string; rows: DetailRow[] };
  cta?: {
    label: string;
    href: string;
    /** Print the raw URL under the button (auth links people copy). */
    showUrl?: boolean;
    /** The one money-moving fix (update card): sunflower on the panel. */
    urgent?: boolean;
  };
  /** Small print after the action. */
  after?: Paragraph[];
  /** Why the recipient got this, in the footer. */
  reason: string;
};

export const strong = (text: string): Inline => ({ strong: text });
export const money = (text: string): Inline => ({ money: text });
export const link = (text: string, href: string): Inline => ({
  link: text,
  href,
});

export function inlineText(paragraph: Paragraph): string {
  return paragraph
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if ("strong" in part) {
        return part.strong;
      }
      if ("money" in part) {
        return part.money;
      }
      return `${part.link} (${part.href})`;
    })
    .join("");
}

/** Joins a date's words with no-break spaces so "12 November 2026" never
 *  wraps across lines. */
export const nb = (text: string) => text.replace(/ /g, "\u00a0");

/** "Adaeze Okafor" → "Adaeze". */
export function firstName(name?: string): string | undefined {
  const first = name?.trim().split(/\s+/)[0];
  return first || undefined;
}

/**
 * The plain-text alternative. Written for people reading it in a terminal
 * client or a watch: the facts first, labels on their own, the link spelled
 * out, and the same words as the HTML.
 */
export function toPlainText(
  content: EmailContent,
  footer: { productName: string; supportUrl?: string }
): string {
  const blocks: string[] = [];
  blocks.push(content.headline);
  if (content.status) {
    blocks.push(`Status: ${content.status.label}`);
  }
  if (content.greetingName) {
    blocks.push(`Hi ${content.greetingName},`);
  }
  for (const p of content.body) {
    blocks.push(inlineText(p));
  }
  if (content.callout) {
    blocks.push(inlineText(content.callout.text));
  }
  if (content.details) {
    blocks.push(
      content.details.rows.map((r) => `${r.label}: ${r.value}`).join("\n")
    );
  }
  if (content.cta) {
    blocks.push(`${content.cta.label}:\n${content.cta.href}`);
  }
  for (const p of content.after ?? []) {
    blocks.push(inlineText(p));
  }
  blocks.push(
    [
      "--",
      content.reason,
      footer.supportUrl
        ? `${footer.productName} support: ${footer.supportUrl.replace(/^mailto:/, "")}`
        : footer.productName,
    ].join("\n")
  );
  return `${blocks.join("\n\n")}\n`;
}
