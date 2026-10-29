/** Org picker layout preference, read on the server so SSR renders it. */
export const ORG_VIEW_COOKIE = "tsp-org-view";

/** The organization last opened in this browser: where sign-in lands. */
export const LAST_ORG_COOKIE = "tsp-last-org";

/**
 * Where to go straight after signing in: the last organization opened here
 * if the user still belongs to it, else their only one. Null keeps the
 * picker (none, or several and no memory).
 */
export function landingOrg(orgSlugs: string[], lastSlug: string | undefined) {
  if (lastSlug && orgSlugs.includes(lastSlug)) {
    return lastSlug;
  }
  return orgSlugs.length === 1 ? (orgSlugs[0] ?? null) : null;
}
