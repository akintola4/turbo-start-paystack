import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  createMailer,
  EMAIL_ASSET_FILES,
  type EmailMessage,
} from "@workspace/email";
import { describe, expect, it } from "vitest";

import {
  EMAIL_ASSET_CACHE_CONTROL,
  emailAssetHeaders,
} from "../src/lib/email-assets";

const publicEmail = join(import.meta.dirname, "../public/email");

describe("email assets", () => {
  it("ships every font and icon the emails reference", () => {
    const missing = EMAIL_ASSET_FILES.filter(
      (file) => !existsSync(join(publicEmail, file))
    );
    expect(missing).toEqual([]);
  });

  it("serves them with a long cache, and fonts with CORS", () => {
    const headers = emailAssetHeaders();
    const all = headers.find((h) => h.source === "/email/:path*");
    expect(all?.headers).toContainEqual({
      key: "Cache-Control",
      value: EMAIL_ASSET_CACHE_CONTROL,
    });
    const fonts = headers.find((h) => h.source === "/email/fonts/:path*");
    expect(fonts?.headers).toContainEqual({
      key: "Access-Control-Allow-Origin",
      value: "*",
    });
  });

  it("points emails at the app URL's /email folder", async () => {
    const sent: EmailMessage[] = [];
    const mailer = createMailer({
      appUrl: "https://billing.kola.test/",
      send: async (message) => {
        sent.push(message);
      },
    });
    await mailer.paymentReceipt({
      to: "ada@kola.test",
      organizationName: "Kola Logistics",
      organizationSlug: "kola",
      planName: "Pro",
      interval: "monthly",
      amountSubunit: 3_000_000,
      currency: "NGN",
      reference: "tsp_1",
      paidAt: new Date("2026-10-12T09:00:00Z"),
    });
    const html = sent[0]?.html ?? "";
    expect(html).toContain(
      "https://billing.kola.test/email/fonts/geist-latin.woff2"
    );
    expect(html).toContain(
      "https://billing.kola.test/email/icons/circle-check-success.png"
    );
    // Every icon the email asks for exists in public/email.
    for (const [, path] of html.matchAll(
      /https:\/\/billing\.kola\.test\/email\/([^"')]+)/g
    )) {
      expect(existsSync(join(publicEmail, path ?? ""))).toBe(true);
    }
  });
});
