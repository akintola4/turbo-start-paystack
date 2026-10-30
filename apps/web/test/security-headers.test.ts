import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  API_CSP,
  contentSecurityPolicy,
  staticSecurityHeaders,
} from "../src/lib/security-headers";
import { config, proxy } from "../src/proxy";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `) || d === name)
    ?.split(" ")
    .slice(1);

describe("content security policy (audit #4)", () => {
  const prod = contentSecurityPolicy({ nonce: "abc123", dev: false });

  it("allows scripts only by nonce, and nothing may frame the app", () => {
    expect(directive(prod, "script-src")).toEqual([
      "'self'",
      "'nonce-abc123'",
      "'strict-dynamic'",
      "https://js.paystack.co",
    ]);
    expect(directive(prod, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(prod, "object-src")).toEqual(["'none'"]);
    expect(directive(prod, "base-uri")).toEqual(["'self'"]);
    expect(directive(prod, "form-action")).toEqual(["'self'"]);
    expect(prod).not.toContain("unsafe-eval");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("lets Paystack's inline checkout and the status badge work", () => {
    expect(directive(prod, "frame-src")).toEqual([
      "https://checkout.paystack.com",
    ]);
    expect(directive(prod, "connect-src")).toEqual([
      "'self'",
      "https://api.paystack.co",
      "https://standard.paystack.co",
      "https://status.paystack.com",
    ]);
    expect(directive(prod, "img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(directive(prod, "font-src")).toEqual(["'self'"]);
  });

  it("adds eval only in development, and no https upgrade on localhost", () => {
    const dev = contentSecurityPolicy({ nonce: "n", dev: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });

  it("sets the static headers, with HSTS in production only", () => {
    const keys = (production: boolean) =>
      Object.fromEntries(
        staticSecurityHeaders({ production }).map((h) => [h.key, h.value])
      );
    expect(keys(true)).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    });
    expect(keys(true)["Permissions-Policy"]).toContain("camera=()");
    expect(keys(true)["Permissions-Policy"]).toContain("microphone=()");
    expect(keys(true)["Permissions-Policy"]).toContain("geolocation=()");
    expect(keys(false)["Strict-Transport-Security"]).toBeUndefined();
    expect(API_CSP).toBe("default-src 'none'; frame-ancestors 'none'");
  });
});

describe("proxy", () => {
  it("puts a fresh nonce in the page's CSP and hands it to rendering", () => {
    const first = proxy(new NextRequest("http://localhost:3000/"));
    const second = proxy(new NextRequest("http://localhost:3000/"));
    const csp = first.headers.get("content-security-policy") ?? "";
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(
      first.headers.get("x-middleware-request-content-security-policy")
    ).toBe(csp);
    expect(second.headers.get("content-security-policy")).not.toBe(csp);
  });

  it("still sends /app visitors without a session to sign-in, with a CSP", () => {
    const res = proxy(
      new NextRequest("http://localhost:3000/app/kola?tab=billing")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?callbackURL=%2Fapp%2Fkola%3Ftab%3Dbilling"
    );
    expect(res.headers.get("content-security-policy")).toContain("nonce-");
    // /apple-icon is not under /app.
    expect(
      proxy(new NextRequest("http://localhost:3000/apple-icon")).status
    ).toBe(200);
  });

  it("matches pages but not API routes or static files", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ["/", "/sign-in", "/app/kola/settings", "/apple-icon"]) {
      expect(matcher.test(path), path).toBe(true);
    }
    for (const path of [
      "/api/auth/sign-in/email",
      "/_next/static/chunks/main.js",
      "/email/fonts/geist.woff2",
      "/icon.svg",
    ]) {
      expect(matcher.test(path), path).toBe(false);
    }
  });
});
