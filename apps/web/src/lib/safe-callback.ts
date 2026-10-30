/**
 * Only same-origin relative paths are allowed as post-auth redirects: a `/`
 * followed by something other than `/` or `\`, with no whitespace, control
 * characters or backslashes anywhere. Browsers treat `//host`, `/\host` and
 * `/<tab>/host` as another origin, so all of those fall back to `/app`.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point
const SAFE_PATH = /^\/(?![/\\])[^\s\u0000-\u001f\u007f\\]*$/u;

export function safeCallback(value: string | null): string {
  if (value && SAFE_PATH.test(value)) {
    return value;
  }
  return "/app";
}

/** Where a signed-in user lands. Plain `/app` may skip the org picker (see
 *  app/app/page.tsx). */
export function postAuthLanding(callbackURL: string): string {
  return callbackURL === "/app" ? "/app?from=sign-in" : callbackURL;
}
