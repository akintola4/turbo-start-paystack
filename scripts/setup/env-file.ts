import { randomBytes } from "node:crypto";

/**
 * apps/web/.env handling for `pnpm setup`. Pure functions over the file's
 * text, so they can be tested without touching disk. The rule: a value that
 * is already set is never changed; only blanks and the template's
 * placeholders are filled. Secret values never leave these functions except
 * in the text written to the file.
 */

const LINE = /^\s*(#\s*)?([A-Z][A-Z0-9_]*)\s*=(.*)$/;

export function parseEnv(text: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = line.match(LINE);
    if (!match || match[1]) {
      continue;
    }
    const key = match[2] as string;
    let value = (match[3] ?? "").trim();
    if (
      value.length >= 2 &&
      (value.startsWith('"') || value.startsWith("'")) &&
      value.endsWith(value[0] as string)
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

/** Template values in .env.example that mean "not filled in yet". */
const TEMPLATE_VALUES = new Set([
  "sk_test_replace_me",
  "pk_test_replace_me",
  "Turbo Start <noreply@example.com>",
]);

export function isPlaceholder(value: string | undefined): boolean {
  return (
    value === undefined ||
    value === "" ||
    value.startsWith("replace-with") ||
    TEMPLATE_VALUES.has(value)
  );
}

export type EnvPlan = {
  /** Keys to write, with their new values. */
  updates: Record<string, string>;
  /** Keys that already had a value and were left alone. */
  kept: string[];
};

/**
 * Decides what to write. `desired` is what setup would like; a key is only
 * written when its current value is missing, blank or a placeholder, or the
 * key is listed in `force` (setup uses that for values it created itself in
 * this run, e.g. a freshly copied template's localhost URLs).
 */
export function planEnv(
  current: Map<string, string>,
  desired: Record<string, string>,
  force: ReadonlySet<string> = new Set()
): EnvPlan {
  const updates: Record<string, string> = {};
  const kept: string[] = [];
  for (const [key, value] of Object.entries(desired)) {
    const now = current.get(key);
    if (force.has(key) || isPlaceholder(now)) {
      if (now !== value) {
        updates[key] = value;
      }
    } else {
      kept.push(key);
    }
  }
  return { updates, kept };
}

/** Writes `updates` into the text: replaces `KEY=…`, uncomments `# KEY=…`,
 *  or appends under a "Local development" heading. */
export function applyEnv(
  text: string,
  updates: Record<string, string>
): string {
  const lines = text.split("\n");
  const missing: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    const set = lines.findIndex((l) => {
      const m = l.match(LINE);
      return m && !m[1] && m[2] === key;
    });
    const commented = lines.findIndex((l) => {
      const m = l.match(LINE);
      return m?.[1] && m[2] === key;
    });
    const index = set >= 0 ? set : commented;
    if (index >= 0) {
      lines[index] = `${key}=${formatValue(value)}`;
    } else {
      missing.push(`${key}=${formatValue(value)}`);
    }
  }
  let out = lines.join("\n");
  if (missing.length > 0) {
    out = `${out.replace(/\n*$/, "\n")}\n# Local development (pnpm setup)\n${missing.join("\n")}\n`;
  }
  return out;
}

function formatValue(value: string): string {
  return /[\s#"'<>]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value;
}

/** Fresh secrets in the formats packages/env validates. */
export function generateSecrets(): Record<string, string> {
  return {
    BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
    BILLING_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    CRON_SECRET: randomBytes(24).toString("hex"),
  };
}

export const SECRET_KEYS = new Set(Object.keys(generateSecrets()));

export const SETUP_HEADER = [
  "# Written by `pnpm setup` for local development. Real values, not placeholders:",
  "# keep this file out of git. Setup fills blanks on later runs and never",
  "# overwrites a value you set, so edit it by hand to change one.",
];

/** `.env.example` as the start of a new apps/web/.env: its "copy me" header
 *  (the comment lines before the first blank line) becomes SETUP_HEADER. */
export function fromTemplate(template: string): string {
  const lines = template.split("\n");
  const end = lines.findIndex((l) => !l.startsWith("#"));
  return [...SETUP_HEADER, ...lines.slice(end < 0 ? lines.length : end)].join(
    "\n"
  );
}
