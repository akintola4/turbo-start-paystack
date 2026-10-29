"use client";

import { useEffect } from "react";

import { LAST_ORG_COOKIE } from "@/lib/org-view";

/** Notes the open organization, so the next sign-in lands back in it. */
export function RememberOrg({ slug }: { slug: string }) {
  useEffect(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: a one-value, non-sensitive preference; Cookie Store isn't in Safari.
    document.cookie = `${LAST_ORG_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=31536000; samesite=lax`;
  }, [slug]);
  return null;
}
