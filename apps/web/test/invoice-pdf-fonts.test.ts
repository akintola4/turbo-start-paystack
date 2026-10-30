import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { InvoiceDocument } from "@workspace/billing";
import { afterEach, describe, expect, it, vi } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("../src/server/invoice-pdf.tsx", import.meta.url)),
  "utf8"
);

const doc: InvoiceDocument = {
  id: "inv_1",
  number: "INV-2026-000001",
  title: "Invoice",
  status: "paid",
  kind: "renewal",
  currency: "NGN",
  seller: { name: "Turbo Start Ltd" },
  buyer: { name: "Kola Logistics" },
  issuedAt: "2026-11-12T09:00:00.000Z",
  paidAt: "2026-11-12T09:00:00.000Z",
  refundedAt: null,
  periodStart: "2026-11-12T00:00:00.000Z",
  periodEnd: "2026-12-12T00:00:00.000Z",
  lines: [{ description: "Pro plan", detail: null, amountSubunit: 3_000_000 }],
  totals: {
    netSubunit: 3_000_000,
    taxSubunit: 0,
    taxRateBp: 0,
    totalSubunit: 3_000_000,
    refundedSubunit: 0,
    paidSubunit: 3_000_000,
  },
  payment: { brand: "visa", last4: "4242" },
  reference: "ref_123",
  paystackInvoiceCode: null,
};

describe("invoice PDF fonts", () => {
  afterEach(() => {
    vi.doUnmock("node:fs/promises");
    vi.resetModules();
  });

  it("loads only fonts colocated with the module, so they are traced", () => {
    // A node_modules path is a pnpm symlink the Vercel function never got:
    // the PDF route threw ENOENT and the rejection took the process down.
    expect(source).not.toContain("process.cwd()");
    expect(source).not.toContain("node_modules");
    const fonts = [
      ...source.matchAll(/new URL\("(\.\/pdf-fonts\/[^"]+)"/g),
    ].map((m) => m[1] as string);
    expect(fonts).toHaveLength(7);
    for (const font of fonts) {
      const url = new URL(`../src/server/${font.slice(2)}`, import.meta.url);
      expect(existsSync(fileURLToPath(url)), font).toBe(true);
    }
  });

  it("reads nothing at import, fails one request on a missing font, then recovers", async () => {
    const real =
      await vi.importActual<typeof import("node:fs/promises")>(
        "node:fs/promises"
      );
    let missing = true;
    const readFile = vi.fn((path: URL) =>
      missing
        ? Promise.reject(new Error("ENOENT: no such file"))
        : real.readFile(path)
    );
    vi.doMock("node:fs/promises", () => ({ readFile, default: { readFile } }));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const mod = await import("../src/server/invoice-pdf");
      expect(readFile).not.toHaveBeenCalled();

      await expect(mod.renderInvoicePdf(doc)).rejects.toThrow("ENOENT");

      missing = false;
      const pdf = await mod.renderInvoicePdf(doc);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      // Every read was one of the colocated fonts, never node_modules.
      for (const [url] of readFile.mock.calls) {
        expect(String(url)).toContain("/server/pdf-fonts/");
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off("unhandledRejection", unhandled);
    }
  });
});
