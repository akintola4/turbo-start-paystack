import { describe, expect, it } from "vitest";

import {
  allowedFor,
  fuzzyMatch,
  highlightParts,
  type PaletteItem,
  searchItems,
  staticItems,
} from "../src/lib/command-search";

const titles = (items: { title: string }[]) => items.map((i) => i.title);
const ITEMS = staticItems("kola-logistics");

describe("palette permissions", () => {
  it("owners see every page and action", () => {
    expect(titles(allowedFor(ITEMS, "owner"))).toEqual(titles(ITEMS));
  });

  it("members see no billing pages or billing actions", () => {
    const seen = titles(allowedFor(ITEMS, "member"));
    expect(seen).toEqual(["Overview", "Members", "Toggle theme", "Sign out"]);
  });

  it("billing managers see billing but can't invite", () => {
    const seen = titles(allowedFor(ITEMS, "billing"));
    expect(seen).toContain("Update card");
    expect(seen).toContain("Invoices");
    expect(seen).not.toContain("Invite teammate");
  });

  it("admins view billing but can't spend money", () => {
    const seen = titles(allowedFor(ITEMS, "admin"));
    expect(seen).toContain("Billing");
    expect(seen).toContain("Invite teammate");
    expect(seen).not.toContain("Update card");
    expect(seen).not.toContain("Change plan");
  });

  it("an unknown role sees only what needs no permission", () => {
    expect(titles(allowedFor(ITEMS, "intruder"))).toEqual([
      "Overview",
      "Members",
      "Toggle theme",
      "Sign out",
    ]);
  });
});

describe("fuzzy matching", () => {
  it("matches characters in order and rejects the rest", () => {
    expect(fuzzyMatch("mbr", "Members")).not.toBeNull();
    expect(fuzzyMatch("rbm", "Members")).toBeNull();
  });

  it("ranks a prefix above a scattered match", () => {
    const prefix = fuzzyMatch("inv", "Invoices");
    const scattered = fuzzyMatch("inv", "Change plan invite");
    expect(prefix?.score).toBeGreaterThan(scattered?.score ?? 0);
  });

  it("returns ranges that cover the matched characters", () => {
    expect(fuzzyMatch("bill", "Billing")?.ranges).toEqual([[0, 4]]);
    expect(fuzzyMatch("tt", "Toggle theme")?.ranges).toEqual([
      [0, 1],
      [7, 8],
    ]);
  });

  it("matches invoice numbers exactly", () => {
    const items: PaletteItem[] = [
      { id: "a", group: "Invoices", title: "INV-2026-0012" },
      { id: "b", group: "Invoices", title: "INV-2026-0003" },
    ];
    const [top] = searchItems(items, "0012");
    expect(top?.item.id).toBe("a");
    expect(top?.ranges).toEqual([[9, 13]]);
  });

  it("searches keywords without highlighting the title", () => {
    const [top] = searchItems(ITEMS, "dark");
    expect(top?.item.title).toBe("Toggle theme");
    expect(top?.ranges).toEqual([]);
  });

  it("keeps the given order for an empty query", () => {
    expect(titles(searchItems(ITEMS, "  ").map((r) => r.item))).toEqual(
      titles(ITEMS)
    );
  });

  it("splits text into highlight parts", () => {
    expect(highlightParts("Billing", [[0, 4]])).toEqual([
      { text: "Bill", match: true },
      { text: "ing", match: false },
    ]);
  });
});
