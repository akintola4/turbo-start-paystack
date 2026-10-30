/**
 * Organization name and address rules. Better Auth's own create/update
 * endpoints check them (server.ts hooks), and the settings routes and forms
 * in apps/web use the same functions, so every path agrees.
 */

export const SLUG_MIN = 3;
export const SLUG_MAX = 48;
export const NAME_MAX = 64;
/** Why a slug can't be used, in one short line (the settings form keeps it
 *  to one), or null when it can. */
export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN) {
    return `Use at least ${SLUG_MIN} characters.`;
  }
  if (slug.length > SLUG_MAX) {
    return `Use at most ${SLUG_MAX} characters.`;
  }
  if (/[^a-z0-9-]/.test(slug)) {
    return "Use lowercase letters, numbers and hyphens.";
  }
  if (slug.startsWith("-") || slug.endsWith("-")) {
    return "Don't start or end with a hyphen.";
  }
  if (slug.includes("--")) {
    return "Use one hyphen at a time.";
  }
  return null;
}

/** Why a name can't be used, or null. Outer spaces don't count. */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return "Enter a name.";
  }
  if (trimmed.length > NAME_MAX) {
    return `Use at most ${NAME_MAX} characters.`;
  }
  return null;
}
