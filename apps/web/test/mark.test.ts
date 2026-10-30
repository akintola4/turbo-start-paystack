import { describe, expect, it } from "vitest";

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
