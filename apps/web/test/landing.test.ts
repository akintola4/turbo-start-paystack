import { CURRENCIES } from "@workspace/billing/money";
import { describe, expect, it } from "vitest";

import {
  AGENT_IDEA_PLACEHOLDER,
  AGENT_PROMPT,
  barcode,
  CURRENCY_META,
  currencyMeta,
  formatUpdated,
  INSTALL_COMMAND,
  INSTALL_STEPS,
  parseProviderStatus,
  rippleDelay,
  SITE,
  WALL,
} from "../src/lib/landing";

describe("landing currencies", () => {
  it("has a tile glyph and a word for every billing currency", () => {
    expect(CURRENCY_META.map((c) => c.code)).toEqual([...CURRENCIES]);
    expect(currencyMeta("GHS")).toMatchObject({ glyph: "₵", word: "cedis" });
  });

  it("shows every currency at least twice on desktop and on phones", () => {
    for (const layout of [WALL, WALL.slice(0, 12)]) {
      for (const code of CURRENCIES) {
        expect(layout.filter((c) => c === code).length).toBeGreaterThanOrEqual(
          2
        );
      }
    }
  });

  it("never puts the same currency side by side on the wall", () => {
    for (const columns of [8, 4]) {
      WALL.forEach((code, i) => {
        if (i % columns !== columns - 1 && i + 1 < WALL.length) {
          expect(WALL[i + 1]).not.toBe(code);
        }
      });
    }
  });
});

describe("rippleDelay", () => {
  it("starts at the touched tile and grows with distance", () => {
    expect(rippleDelay(3, 3, 8)).toBe(0);
    expect(rippleDelay(4, 3, 8)).toBe(28);
    expect(rippleDelay(11, 3, 8)).toBe(28);
    expect(rippleDelay(12, 3, 8)).toBeGreaterThan(rippleDelay(4, 3, 8));
  });
});

describe("barcode", () => {
  it("is stable for a seed and changes with it", () => {
    expect(barcode("v0.1.0")).toEqual(barcode("v0.1.0"));
    expect(barcode("v0.1.0")).not.toEqual(barcode("v0.2.0"));
    expect(barcode("x", 12).every((w) => w >= 1 && w <= 4)).toBe(true);
  });
});

describe("parseProviderStatus", () => {
  it("maps Paystack's status page values", () => {
    expect(parseProviderStatus("UP")).toBe("normal");
    expect(parseProviderStatus("HASISSUES")).toBe("degraded");
    expect(parseProviderStatus("MINOROUTAGE")).toBe("degraded");
    expect(parseProviderStatus("UNDERMAINTENANCE")).toBe("maintenance");
  });

  it("calls one affected component an incident, not an outage", () => {
    expect(parseProviderStatus("ONEMAJOROUTAGE")).toBe("incident");
    expect(parseProviderStatus("ONEMINOROUTAGE")).toBe("incident");
    expect(parseProviderStatus("ALLMAJOROUTAGE")).toBe("outage");
  });

  it("returns null for anything it doesn't recognise", () => {
    expect(parseProviderStatus("SOMETHINGNEW")).toBeNull();
    expect(parseProviderStatus(undefined)).toBeNull();
    expect(parseProviderStatus(42)).toBeNull();
  });
});

describe("formatUpdated", () => {
  it("formats a commit date as a short human date", () => {
    expect(formatUpdated("2026-10-29T11:58:03+01:00")).toBe("29 Oct 2026");
  });

  it("drops missing or broken dates", () => {
    expect(formatUpdated(undefined)).toBeNull();
    expect(formatUpdated("")).toBeNull();
    expect(formatUpdated("not a date")).toBeNull();
  });
});

describe("install command", () => {
  it("is the README's steps chained into one line", () => {
    expect(INSTALL_STEPS[0]).toBe(
      "npx degit akintola4/turbo-start-paystack my-saas"
    );
    expect(INSTALL_STEPS.at(-1)).toBe("pnpm setup");
    expect(INSTALL_COMMAND).toBe(
      "npx degit akintola4/turbo-start-paystack my-saas && cd my-saas && pnpm install && pnpm setup"
    );
  });
});

describe("agent prompt", () => {
  it("points at the agent guide, runs the install command and leaves a gap for the idea", () => {
    expect(AGENT_PROMPT).toContain(`${SITE}/llms.txt`);
    expect(AGENT_PROMPT).toContain("AGENTS.md");
    expect(AGENT_PROMPT).toContain(INSTALL_COMMAND);
    expect(AGENT_PROMPT).toContain(AGENT_IDEA_PLACEHOLDER);
    expect(AGENT_PROMPT).toContain("stop after step 3");
    expect(AGENT_PROMPT).toContain("Node 24+");
  });
});
