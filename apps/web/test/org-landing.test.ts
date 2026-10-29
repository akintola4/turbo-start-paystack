import { describe, expect, it } from "vitest";

import { landingOrg } from "../src/lib/org-view";
import { slugify } from "../src/components/orgs/create-org-form";

describe("landingOrg", () => {
  it("goes back to the last organization opened here", () => {
    expect(landingOrg(["acme", "kola"], "kola")).toBe("kola");
  });

  it("goes to the only organization", () => {
    expect(landingOrg(["kola"], undefined)).toBe("kola");
  });

  it("keeps the picker for several and no memory, or a stale one", () => {
    expect(landingOrg(["acme", "kola"], undefined)).toBeNull();
    expect(landingOrg(["acme", "kola"], "gone")).toBeNull();
    expect(landingOrg([], undefined)).toBeNull();
  });
});

describe("slugify", () => {
  it("makes an address from a name", () => {
    expect(slugify("  Kola Logistics Ltd. ")).toBe("kola-logistics-ltd");
  });
});
