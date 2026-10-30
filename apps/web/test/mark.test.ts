import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import type { MarkSignal } from "../src/components/auth/mark-signals";

import {
  GRID,
  markCode,
  markGrid,
  mirror,
  SLOT_ORDER,
  SLOTS,
  SUN_AFTER,
  slotKey,
  slotsFor,
} from "../src/lib/mark";

const EMAILS = [
  "ada@kolalogistics.test",
  "amara@lagosbakery.test",
  "a@b.co",
  "kwame.mensah@accra-freight.com.gh",
  "x".repeat(40),
];

const suns = (input: string) =>
  markGrid(input).filter((s) => s?.colour === "sun").length;

describe("your mark", () => {
  it("is the same mark for the same email, every time", () => {
    for (const email of EMAILS) {
      expect(markGrid(email).map(slotKey)).toEqual(
        markGrid(email).map(slotKey)
      );
      expect(markCode(email)).toBe(markCode(email));
    }
  });

  it("differs between emails", () => {
    const keys = new Set(EMAILS.map((e) => markGrid(e).map(slotKey).join("|")));
    expect(keys.size).toBe(EMAILS.length);
  });

  it("is mirrored around the centre column", () => {
    for (const email of EMAILS) {
      const grid = markGrid(email);
      for (let r = 0; r < GRID; r++) {
        for (const c of [0, 1]) {
          const left = grid[r * GRID + c];
          const right = grid[r * GRID + (GRID - 1 - c)];
          expect(slotKey(right ?? null)).toBe(
            slotKey(left ? mirror(left) : null)
          );
        }
      }
    }
  });

  it("draws one slot per keystroke until all 15 are drawn", () => {
    const email = "ada@kolalogistics.test";
    for (let n = 0; n <= SLOTS; n++) {
      const drawn = slotsFor(email.slice(0, n)).filter(Boolean).length;
      expect(drawn).toBe(Math.min(n, SLOTS));
    }
  });

  it("has exactly one sunflower cell once the email is long enough", () => {
    for (const email of EMAILS) {
      for (let n = 1; n <= email.length; n++) {
        expect(suns(email.slice(0, n))).toBe(n < SUN_AFTER ? 0 : 1);
      }
    }
  });

  it("puts the sunflower in the centre column, so the mirror can't double it", () => {
    for (const email of EMAILS) {
      const index = markGrid(email).findIndex((s) => s?.colour === "sun");
      expect(index % GRID).toBe(2);
    }
  });

  it("draws columns 0–2 exactly once each", () => {
    expect(SLOT_ORDER).toHaveLength(SLOTS);
    expect(new Set(SLOT_ORDER.map(([r, c]) => `${r}:${c}`)).size).toBe(SLOTS);
  });

  it("has no code and only seed dots for an empty email", () => {
    expect(markCode("")).toBe("");
    expect(markGrid("").every((s) => s === null)).toBe(true);
  });
});

describe("what the panel is told", () => {
  // Every key any signal can carry.
  type SignalKeys = MarkSignal extends infer S
    ? S extends unknown
      ? keyof S
      : never
    : never;

  it("never carries the password or which field failed", () => {
    expectTypeOf<
      "password" extends SignalKeys ? true : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      "field" extends keyof Extract<MarkSignal, { type: "error" }>
        ? true
        : false
    >().toEqualTypeOf<false>();
    expectTypeOf<
      Extract<MarkSignal, { type: "input" }>["field"]
    >().toEqualTypeOf<"email" | "name">();
  });

  it("hears only 'clear' from the password field", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/components/auth/auth-form.tsx"),
      "utf8"
    );
    const start = source.indexOf('id="password"');
    const block = source.slice(start, source.indexOf("/>", start));
    const signals = [...block.matchAll(/signal\(\{\s*type:\s*"(\w+)"/g)].map(
      (m) => m[1]
    );
    expect(signals).toEqual(["clear"]);
    expect(block).not.toMatch(/signal\([^)]*value/);
  });

  it("reports a failure without saying why", () => {
    const source = readFileSync(
      join(import.meta.dirname, "../src/components/auth/auth-form.tsx"),
      "utf8"
    );
    const errors = [
      ...source.matchAll(/signal\((\{[^}]*type:\s*"error"[^}]*\})\)/g),
    ].map((m) => m[1]?.replace(/\s/g, ""));
    expect(errors).toEqual(['{type:"error"}']);
  });
});
