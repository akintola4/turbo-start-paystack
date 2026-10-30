import { describe, expect, it } from "vitest";

import { renderEmail } from "./render";
import { type TemplateName, templates } from "./templates/index";
import { createTheme } from "./theme";

const names = Object.keys(templates) as TemplateName[];

describe("every template", () => {
  it.each(names)("%s renders html, text and a subject", async (name) => {
    const props = templates[name].Component.PreviewProps;
    const email = await renderEmail(name, props as never);
    expect(email.subject.length).toBeGreaterThan(5);
    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.html).toMatch(/^<!DOCTYPE html/);
    expect(email.html).toContain('name="color-scheme"');
    expect(email.html).toContain("prefers-color-scheme:dark");
    expect(email.text.length).toBeGreaterThan(40);
    expect(email.text).not.toMatch(/<[a-z]/i);
    // Every link in the HTML is absolute https (or the support mailto).
    for (const [, href] of email.html.matchAll(/href="([^"]+)"/g)) {
      expect(href).toMatch(/^(https:\/\/|mailto:)/);
    }
  });
});

describe("content", () => {
  it("verification email carries the link in both parts", async () => {
    const url = "https://app.test/api/auth/verify-email?token=t1";
    const email = await renderEmail("verify-email", { name: "Ada", url });
    expect(email.html).toContain(
      "https://app.test/api/auth/verify-email?token=t1"
    );
    expect(email.text).toContain(url);
    expect(email.text).toContain("Hi Ada");
  });

  it("a change-email link says it replaces the old address", async () => {
    const url = "https://app.test/api/auth/verify-email?token=t2";
    const email = await renderEmail("verify-email", {
      name: "Ada",
      url,
      purpose: "change-email",
    });
    expect(email.subject).toBe("Confirm your new email address");
    expect(email.text).toContain("replaces your old one");
    expect(email.text).toContain(url);
    expect(email.text).not.toContain("sign up");
  });

  it("invitation shows inviter, org, role and expiry, and escapes names", async () => {
    const email = await renderEmail("organization-invitation", {
      inviterName: "Tunde <script>alert(1)</script>",
      inviterEmail: "tunde@acme.test",
      organizationName: "Acme & Sons",
      role: "billing",
      recipientEmail: "ada@acme.test",
      acceptUrl: "https://app.test/accept-invite/inv_1",
      expiresInDays: 7,
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Acme &amp; Sons");
    expect(email.text).toContain("Role: Billing");
    expect(email.text).toContain("Expires: In 7 days");
    expect(email.text).toContain("https://app.test/accept-invite/inv_1");
    expect(email.subject).toBe(
      "Tunde <script>alert(1)</script> invited you to Acme & Sons"
    );
  });

  it("receipt formats money per currency and dates in UTC", async () => {
    const base = templates["payment-receipt"].Component.PreviewProps;
    const cases = [
      ["NGN", 3_000_000, "₦30,000.00"],
      ["GHS", 45_000, "GH₵450.00"],
      ["ZAR", 54_000, "R540.00"],
      ["KES", 390_000, "KSh\u202f3,900.00"],
      ["USD", 3000, "$30.00"],
    ] as const;
    for (const [currency, amountSubunit, shown] of cases) {
      const email = await renderEmail("payment-receipt", {
        ...base,
        currency,
        amountSubunit,
      });
      expect(email.text).toContain(`Amount paid: ${shown}`);
      expect(email.subject).toContain(shown);
    }
    const email = await renderEmail("payment-receipt", base);
    expect(email.text).toContain("Period: 12 Oct 2026 – 12 Nov 2026");
    expect(email.text).toContain("Paid on: 12 October 2026");
    expect(email.text).toContain(`Reference: ${base.reference}`);
    expect(email.text).toContain("Plan: Pro (monthly)");
  });

  it("failed payment shows the grace deadline and the manage link", async () => {
    const props = templates["payment-failed"].Component.PreviewProps;
    const email = await renderEmail("payment-failed", props);
    expect(email.text).toContain("4 November 2026");
    expect(email.text).toContain(props.manageUrl);
    expect(email.html).toContain(props.manageUrl);
  });

  it("trial ending shows the date, plan and amount", async () => {
    const email = await renderEmail(
      "trial-ending",
      templates["trial-ending"].Component.PreviewProps
    );
    expect(email.subject).toContain("31 October 2026");
    expect(email.text).toContain("First charge: GH₵150.00");
    expect(email.text).toContain("Plan: Starter (monthly)");
  });

  it("cancellation shows the access date and resume link", async () => {
    const props = templates["subscription-canceled"].Component.PreviewProps;
    const email = await renderEmail("subscription-canceled", props);
    expect(email.text).toContain("12 November 2026");
    expect(email.text).toContain(props.resumeUrl);
    const unknown = await renderEmail("subscription-canceled", {
      ...props,
      accessUntil: null,
    });
    expect(unknown.text).toContain("when the current period ends");
  });

  it("plan change: upgrade shows the charge, downgrade the date", async () => {
    const base = templates["plan-changed"].Component.PreviewProps;
    const up = await renderEmail("plan-changed", base);
    expect(up.subject).toBe("Kola Logistics is now on Pro (monthly)");
    expect(up.text).toContain("Charged now: ₦10,000.00");
    const down = await renderEmail("plan-changed", {
      ...base,
      change: "downgrade",
      fromPlan: "Pro (monthly)",
      toPlan: "Starter (monthly)",
      chargedSubunit: 0,
      effectiveAt: new Date("2026-11-28T09:00:00Z"),
    });
    expect(down.subject).toBe(
      "Kola Logistics moves to Starter (monthly) on 28 November 2026"
    );
    expect(down.text).toContain("Takes effect: 28 November 2026");
    expect(down.text).not.toContain("Charged now");
  });

  it("subjects can't be folded by a line break in user text", async () => {
    const email = await renderEmail("card-expiring", {
      organizationName: "Acme\r\nBcc: x@evil.test",
      manageUrl: "https://app.test/billing",
    });
    expect(email.subject).not.toMatch(/[\r\n]/);
  });
});

describe("theme", () => {
  it("uses the product name, logo and support link", async () => {
    const theme = createTheme({
      productName: "Ledgerly",
      logoUrl: "https://cdn.test/logo.png",
      supportUrl: "https://help.test",
      colors: { brand: "#0a7cff" },
    });
    const email = await renderEmail(
      "verify-email",
      { url: "https://app.test/v" },
      theme
    );
    expect(email.html).toContain('src="https://cdn.test/logo.png"');
    expect(email.html).toContain('alt="Ledgerly"');
    expect(email.html).toContain('href="https://help.test"');
    expect(email.html).toContain("#0a7cff");
    expect(email.text).toContain("finish setting up Ledgerly");
    expect(email.text).not.toContain("logo.png");
  });

  it("shows a wordmark without a logo and no support link when unset", async () => {
    const email = await renderEmail("verify-email", {
      url: "https://app.test/v",
    });
    expect(email.html).toContain("Turbo Start");
    expect(email.html).not.toContain("Contact support");
  });
});

describe("layout", () => {
  it.each(names)("%s fits the client limits", async (name) => {
    const props = templates[name].Component.PreviewProps;
    const email = await renderEmail(
      name,
      props as never,
      createTheme({ assetsUrl: "https://app.test/email" })
    );
    // Gmail clips messages over 102 KB; keep a wide margin.
    expect(Buffer.byteLength(email.html)).toBeLessThan(40 * 1024);
    expect(email.html).toContain("<!--[if mso]>");
    for (const [, href] of email.html.matchAll(/href="([^"]+)"/g)) {
      expect(href).toMatch(/^(https:\/\/|mailto:)/);
    }
    // Every image carries alt (empty for decorative status icons).
    for (const [tag] of email.html.matchAll(/<img[^>]*>/g)) {
      expect(tag).toMatch(/alt="/);
    }
  });

  it("loads Geist and the ₦/₵ subset only when assets are configured", async () => {
    const props = templates["payment-receipt"].Component.PreviewProps;
    const without = await renderEmail("payment-receipt", props);
    expect(without.html).not.toContain("@font-face");
    expect(without.html).not.toContain("<img");
    const withAssets = await renderEmail(
      "payment-receipt",
      props,
      createTheme({ assetsUrl: "https://app.test/email" })
    );
    expect(withAssets.html).toContain(
      "https://app.test/email/fonts/geist-latin.woff2"
    );
    expect(withAssets.html).toContain("unicode-range:U+20A6,U+20B5");
    expect(withAssets.html).toContain(
      "https://app.test/email/icons/circle-check-success.png"
    );
  });

  it("keeps dates on one line in the HTML but not in the text", async () => {
    const props = templates["payment-failed"].Component.PreviewProps;
    const email = await renderEmail("payment-failed", props);
    expect(email.html).toContain("4\u00a0November\u00a02026");
    expect(email.text).toContain("4 November 2026");
  });
});
