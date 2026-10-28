import { describe, expect, it, vi } from "vitest";

import { createEmailSender, getDevOutbox, textToHtml } from "./index";

describe("email", () => {
  it("stores messages in the dev outbox without a provider", async () => {
    const send = createEmailSender({ from: "a@b.test" });
    await send({ to: "x@y.test", subject: "Hi", text: "link http://l/1" });
    expect(getDevOutbox().at(-1)?.to).toBe("x@y.test");
  });

  it("posts to Resend when a key is set", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const send = createEmailSender({
      from: "a@b.test",
      resendApiKey: "re_test",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await send({ to: "x@y.test", subject: "Hi", text: "Body" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("escapes html and links urls", () => {
    expect(textToHtml("<b> http://a.test/x")).toBe(
      '&lt;b&gt; <a href="http://a.test/x">http://a.test/x</a>'
    );
  });
});
