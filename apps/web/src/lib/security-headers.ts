/**
 * Security headers. The page CSP carries a per-request nonce, so the proxy
 * sets it (src/proxy.ts); everything else is static and comes from
 * next.config.ts for every route.
 *
 * Third parties the browser talks to:
 * - Paystack inline checkout (@paystack/inline-js, bundled): frames
 *   checkout.paystack.com, calls api.paystack.co (and standard.paystack.co
 *   for wallet payments), and may load its helper scripts, which
 *   'strict-dynamic' allows because our nonced bundle inserts them.
 *   js.paystack.co is listed for the hosted inline script.
 * - status.paystack.com: the landing page's status badge.
 * Fonts (Geist, the currency subset) are self-hosted by next/font.
 */

const PAYSTACK_CHECKOUT = "https://checkout.paystack.com";
const PAYSTACK_SCRIPT = "https://js.paystack.co";
const PAYSTACK_API = [
  "https://api.paystack.co",
  "https://standard.paystack.co",
];
const PAYSTACK_STATUS = "https://status.paystack.com";

export type CspOptions = {
  nonce: string;
  /** `next dev`: React needs eval for its error overlays. */
  dev: boolean;
};

export function contentSecurityPolicy({ nonce, dev }: CspOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      PAYSTACK_SCRIPT,
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // Inline style attributes (React `style`, motion) and the <style> tag
    // Paystack's inline script injects can't carry a nonce. A nonce here
    // would also switch 'unsafe-inline' off, so styles get no nonce.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...PAYSTACK_API, PAYSTACK_STATUS],
    "frame-src": [PAYSTACK_CHECKOUT],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    ...(dev ? {} : { "upgrade-insecure-requests": [] }),
  };
  return Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");
}

/** CSP for JSON and file responses under /api: nothing may run or frame. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'";

export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "usb=()",
  "browsing-topics=()",
  // Card wallets inside Paystack's checkout frame.
  `payment=(self "${PAYSTACK_CHECKOUT}")`,
].join(", ");

/** Headers for every response, set in next.config.ts. */
export function staticSecurityHeaders({ production }: { production: boolean }) {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
    ...(production
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ]
      : []),
  ];
}

/** A fresh nonce per request: 128 random bits, base64. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
