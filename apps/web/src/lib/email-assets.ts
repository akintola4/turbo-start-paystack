/**
 * Response headers for the files the emails load from `/email`
 * (public/email: Geist, the ₦/₵ subset and the status icons).
 *
 * - Long cache: the files only change when the email package changes, and
 *   mail clients refetch them every time a message is opened. Give a file a
 *   new name if its contents change.
 * - CORS on fonts: WebKit (Apple Mail, iOS Mail) applies the same
 *   cross-origin rule to `@font-face` as Safari, so fonts need
 *   `Access-Control-Allow-Origin`.
 */
export const EMAIL_ASSET_CACHE_CONTROL =
  "public, max-age=2592000, stale-while-revalidate=86400";

export function emailAssetHeaders() {
  return [
    {
      source: "/email/:path*",
      headers: [{ key: "Cache-Control", value: EMAIL_ASSET_CACHE_CONTROL }],
    },
    {
      source: "/email/fonts/:path*",
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
    },
  ];
}
