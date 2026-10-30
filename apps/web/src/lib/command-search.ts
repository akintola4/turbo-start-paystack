/**
 * The ⌘K palette's search: what each role may see, and fuzzy matching with
 * highlight ranges. Pure, so the server route and the client share it and
 * tests cover it without a browser.
 */
import {
  type Permission,
  roleHasPermission,
} from "@workspace/auth/permissions";

export type PaletteGroup =
  | "Pages"
  | "Actions"
  | "Organizations"
  | "Members"
  | "Invoices";

export type PaletteAction =
  | "invite"
  | "update-card"
  | "change-plan"
  | "toggle-theme"
  | "sign-out";

export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  title: string;
  subtitle?: string;
  /** Extra words that match but aren't shown (an invoice's status, an
   *  amount without its symbol). */
  keywords?: string[];
  /** Where Enter goes. */
  href?: string;
  /** Where ⌘/Ctrl+Enter goes, when there's a useful second place. */
  altHref?: string;
  /** Run instead of navigating. */
  action?: PaletteAction;
  /** Shown only to roles with this permission in the current org. */
  requires?: Permission;
};

/** Pages and actions for an org, before permission filtering. */
export function staticItems(orgSlug: string): PaletteItem[] {
  const base = `/app/${orgSlug}`;
  return [
    { id: "page:overview", group: "Pages", title: "Overview", href: base },
    {
      id: "page:members",
      group: "Pages",
      title: "Members",
      keywords: ["team", "people", "seats"],
      href: `${base}/members`,
    },
    {
      id: "page:billing",
      group: "Pages",
      title: "Billing",
      keywords: ["plan", "subscription", "card", "settings"],
      href: `${base}/settings/billing`,
      requires: "billing:view",
    },
    {
      id: "page:invoices",
      group: "Pages",
      title: "Invoices",
      keywords: ["receipts", "payments"],
      href: `${base}/settings/billing#invoices`,
      requires: "billing:view",
    },
    {
      id: "page:billing-details",
      group: "Pages",
      title: "Billing details",
      subtitle: "Settings",
      keywords: ["settings", "tax", "address", "legal name"],
      href: `${base}/settings/billing#billing-details`,
      requires: "billing:manage",
    },
    {
      id: "page:settings",
      group: "Pages",
      title: "Settings",
      subtitle: "Organization",
      keywords: [
        "organization",
        "rename",
        "name",
        "address",
        "slug",
        "logo",
        "leave",
        "currency",
      ],
      href: `${base}/settings`,
    },
    {
      id: "page:account",
      group: "Pages",
      title: "Account",
      keywords: [
        "profile",
        "my account",
        "email",
        "avatar",
        "devices",
        "sessions",
      ],
      href: "/app/account",
    },
    {
      id: "page:organizations",
      group: "Pages",
      title: "All organizations",
      keywords: ["switch", "organizations", "workspaces"],
      href: "/app",
    },
    {
      id: "action:rename-org",
      group: "Actions",
      title: "Rename organization",
      keywords: ["change address", "slug", "name"],
      href: `${base}/settings#general`,
      requires: "organization:update",
    },
    {
      id: "action:transfer-ownership",
      group: "Actions",
      title: "Transfer ownership",
      keywords: ["owner", "hand over"],
      href: `${base}/settings#danger`,
      requires: "organization:delete",
    },
    {
      id: "action:delete-org",
      group: "Actions",
      title: "Delete organization",
      keywords: ["remove", "close"],
      href: `${base}/settings#danger`,
      requires: "organization:delete",
    },
    {
      id: "action:change-password",
      group: "Actions",
      title: "Change password",
      keywords: ["password", "security"],
      href: "/app/account#password",
    },
    {
      id: "action:sign-out-others",
      group: "Actions",
      title: "Sign out other devices",
      keywords: ["sessions", "devices", "log out everywhere", "security"],
      href: "/app/account#sessions",
    },
    {
      id: "action:invite",
      group: "Actions",
      title: "Invite teammate",
      keywords: ["add", "member", "invitation"],
      href: `${base}/members#invite`,
      action: "invite",
      requires: "invitation:create",
    },
    {
      id: "action:update-card",
      group: "Actions",
      title: "Update card",
      keywords: ["payment method", "card"],
      href: `${base}/settings/billing`,
      action: "update-card",
      requires: "billing:manage",
    },
    {
      id: "action:change-plan",
      group: "Actions",
      title: "Change plan",
      keywords: ["upgrade", "downgrade", "plan"],
      href: `${base}/settings/billing#plans`,
      action: "change-plan",
      requires: "billing:manage",
    },
    {
      id: "action:toggle-theme",
      group: "Actions",
      title: "Toggle theme",
      keywords: [
        "light/dark theme",
        "light",
        "dark",
        "system",
        "appearance",
        "mode",
      ],
      action: "toggle-theme",
    },
    {
      id: "action:sign-out",
      group: "Actions",
      title: "Sign out",
      keywords: ["log out"],
      action: "sign-out",
    },
  ];
}

/** Drops what the role can't do. The server checks again on every route;
 *  this only keeps the palette honest. */
export function allowedFor<T extends Pick<PaletteItem, "requires">>(
  items: T[],
  role: string
): T[] {
  return items.filter(
    (item) => !item.requires || roleHasPermission(role, item.requires)
  );
}

export type Range = [start: number, end: number];

type Match = { score: number; ranges: Range[] };

const isWordStart = (t: string, i: number) =>
  i === 0 || /[\s\-_./@#]/.test(t[i - 1] ?? "");

/** Adds index `i` to the ranges, extending the last range when adjacent. */
function addIndex(ranges: Range[], i: number) {
  const prev = ranges.at(-1);
  if (prev && prev[1] === i) {
    prev[1] = i + 1;
  } else {
    ranges.push([i, i + 1]);
  }
}

/** A scattered match may break into this many runs at most. */
const MAX_RUNS = 3;

/**
 * Each query character in order, anywhere after the previous one, in at
 * most three runs, at least one of them two characters or longer. Looser
 * than that ("ligt" in "biLlInG deTails") reads as noise, not a match.
 */
function scatteredMatch(q: string, t: string): Match | null {
  const ranges: Range[] = [];
  let score = 0;
  let from = 0;
  for (const ch of q.replaceAll(" ", "")) {
    const found = t.indexOf(ch, from);
    if (found < 0) {
      return null;
    }
    if (found === from && ranges.length) {
      score += 6;
    } else {
      score += isWordStart(t, found) ? 4 : 1;
    }
    score -= Math.min(3, found - from) * 0.5;
    addIndex(ranges, found);
    from = found + 1;
  }
  const longest = Math.max(...ranges.map(([a, b]) => b - a));
  if (ranges.length > MAX_RUNS || longest < 2) {
    return null;
  }
  return { score: score - ranges.length * 2, ranges };
}

/**
 * Fuzzy match: every query character must appear in order. An exact
 * substring beats any scattered match; prefixes, word starts and runs
 * score higher, gaps cost a little. Null for no match, else a score and
 * the matched ranges for highlighting.
 */
export function fuzzyMatch(query: string, text: string): Match | null {
  const q = query.trim().toLowerCase();
  if (!q) {
    return { score: 0, ranges: [] };
  }
  const t = text.toLowerCase();
  const at = t.indexOf(q);
  if (at < 0) {
    return scatteredMatch(q, t);
  }
  return {
    score:
      100 + q.length * 4 + (at === 0 ? 20 : 0) + (isWordStart(t, at) ? 10 : 0),
    ranges: [[at, at + q.length]],
  };
}

export type PaletteResult<T extends PaletteItem = PaletteItem> = {
  item: T;
  score: number;
  /** Highlight ranges in the title (empty when it matched elsewhere). */
  ranges: Range[];
};

/** The item's best match: its title (highlighted, slightly favoured), or
 *  its subtitle or a keyword (no highlight). */
function bestMatch(item: PaletteItem, query: string): Match | null {
  const title = fuzzyMatch(query, item.title);
  let best = title ? { score: title.score + 5, ranges: title.ranges } : null;
  for (const text of [item.subtitle ?? "", ...(item.keywords ?? [])]) {
    const m = text ? fuzzyMatch(query, text) : null;
    if (m && m.score > (best?.score ?? Number.NEGATIVE_INFINITY)) {
      best = { score: m.score, ranges: [] };
    }
  }
  return best;
}

/** Ranks items for a query. An empty query keeps the given order. */
export function searchItems<T extends PaletteItem>(
  items: T[],
  query: string
): PaletteResult<T>[] {
  const results = items.flatMap((item) => {
    const match = bestMatch(item, query);
    return match ? [{ item, ...match }] : [];
  });
  if (query.trim()) {
    results.sort((a, b) => b.score - a.score);
  }
  return results;
}

/** Splits text into plain and matched parts, for rendering a highlight. */
export function highlightParts(text: string, ranges: Range[]) {
  const parts: { text: string; match: boolean }[] = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start > at) {
      parts.push({ text: text.slice(at, start), match: false });
    }
    parts.push({ text: text.slice(start, end), match: true });
    at = end;
  }
  if (at < text.length) {
    parts.push({ text: text.slice(at), match: false });
  }
  return parts;
}
