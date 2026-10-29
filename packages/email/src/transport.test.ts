import { describe, expect, it, vi } from "vitest";

import { createEmailSender, getDevOutbox, textToHtml } from "./transport";

describe("transport", () => {
  it("stores messages in the dev outbox without a provider", async () => {
    const send = createEmailSender({ from: "a@b.test" });
    await send({
      to: "x@y.test",
      subject: "Hi",
      text: "link http://l/1",
      html: "<p>link</p>",
    });
    expect(getDevOutbox().at(-1)).toMatchObject({
      to: "x@y.test",
      text: "link http://l/1",
      html: "<p>link</p>",
    });
    const entry = getDevOutbox().at(-1);
    expect(entry?.id).toMatch(/^[a-z0-9]+$/);
    expect(Date.parse(entry?.sentAt ?? "")).not.toBeNaN();
  });

  it("refuses to drop mail in production unless explicitly allowed", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const strict = createEmailSender({ from: "a@b.test" });
      await expect(
        strict({ to: "x@y.test", subject: "s", text: "t" })
      ).rejects.toThrow(/RESEND_API_KEY/);
      const local = createEmailSender({
        from: "a@b.test",
        allowLogInProduction: true,
      });
      await expect(
        local({ to: "x@y.test", subject: "s", text: "t" })
      ).resolves.toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("posts html, text and the idempotency key to Resend", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response("{}", { status: 200 })
    );
    const send = createEmailSender({
      from: "Acme <a@b.test>",
      resendApiKey: "re_test",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await send({
      to: "x@y.test",
      subject: "Hi",
      text: "Body",
      html: "<p>Body</p>",
      idempotencyKey: "abc123",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe("abc123");
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "Acme <a@b.test>",
      to: "x@y.test",
      subject: "Hi",
      text: "Body",
      html: "<p>Body</p>",
    });
  });

  it("omits the idempotency header without a key and surfaces errors", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response('{"message":"domain not verified"}', { status: 403 })
    );
    const send = createEmailSender({
      from: "a@b.test",
      resendApiKey: "re_test",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(
      send({ to: "x@y.test", subject: "s", text: "t" })
    ).rejects.toThrow(/403: .*domain not verified/);
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers["Idempotency-Key"]).toBeUndefined();
  });

  it("escapes html and links urls in the fallback html", () => {
    expect(textToHtml("<b> http://a.test/x")).toBe(
      '&lt;b&gt; <a href="http://a.test/x">http://a.test/x</a>'
    );
  });
});
