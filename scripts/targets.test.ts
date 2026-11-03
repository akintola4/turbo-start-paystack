import { describe, expect, it } from "vitest";

import { isLocalUrl, paystackModeLabel, replayTarget } from "./targets";

describe("isLocalUrl", () => {
  it.each([
    ["http://localhost:3000", true],
    ["http://127.0.0.1:4010/", true],
    ["http://[::1]:3000", true],
    ["https://demo.example.test", false],
    ["not a url", false],
  ])("%s is local: %s", (url, local) => {
    expect(isLocalUrl(url)).toBe(local);
  });
});

describe("paystackModeLabel", () => {
  it("says mock when the API is on this machine", () => {
    expect(
      paystackModeLabel("sk_test_local_mock", "http://localhost:4010")
    ).toBe("mock");
  });
  it("says test or LIVE against Paystack", () => {
    expect(paystackModeLabel("sk_test_x", undefined)).toBe("test");
    expect(paystackModeLabel("sk_live_x", "https://api.paystack.co")).toBe(
      "LIVE"
    );
  });
});

describe("replayTarget", () => {
  const key = { PAYSTACK_SECRET_KEY: "sk_test_x" };

  it("defaults to the local app's webhook route", () => {
    expect(
      replayTarget([], { ...key, BETTER_AUTH_URL: "http://localhost:3600/" })
    ).toEqual({
      url: "http://localhost:3600/api/webhooks/paystack",
    });
    expect(replayTarget([], key)).toEqual({
      url: "http://localhost:3000/api/webhooks/paystack",
    });
  });

  it("won't follow a non-local BETTER_AUTH_URL without --url", () => {
    const result = replayTarget([], {
      ...key,
      BETTER_AUTH_URL: "https://demo.example.test",
    });
    expect(result).toHaveProperty("error");
  });

  it("sends to an explicit --url with a test key", () => {
    expect(
      replayTarget(
        ["--url=https://tunnel.example.test/api/webhooks/paystack"],
        key
      )
    ).toEqual({ url: "https://tunnel.example.test/api/webhooks/paystack" });
  });

  it("never sends a live-signed event off this machine", () => {
    const live = { PAYSTACK_SECRET_KEY: "sk_live_x" };
    expect(
      replayTarget(
        ["--url=https://demo.example.test/api/webhooks/paystack"],
        live
      )
    ).toHaveProperty("error");
    expect(replayTarget([], live)).toEqual({
      url: "http://localhost:3000/api/webhooks/paystack",
    });
  });
});
