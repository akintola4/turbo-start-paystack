import { Logger } from "@workspace/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSender = (message: EmailMessage) => Promise<void>;

const logger = new Logger("email");

/** Messages "sent" without a provider, newest last. Dev and smoke tests read
 *  invite and verification links from here. Bounded so it can't grow forever. */
const devOutbox: EmailMessage[] = [];
const DEV_OUTBOX_MAX = 50;

export function getDevOutbox(): readonly EmailMessage[] {
  return devOutbox;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Plain-text first. Links become clickable in the HTML part. */
export function textToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
    .replaceAll("\n", "<br>");
}

/**
 * Sends through Resend's HTTP API when `resendApiKey` is set. Without it the
 * message goes to the dev outbox and a log line; that fallback refuses to run
 * when NODE_ENV is production so mail is never silently dropped there.
 */
export function createEmailSender(options: {
  from: string;
  resendApiKey?: string;
  fetch?: typeof fetch;
}): EmailSender {
  const doFetch = options.fetch ?? fetch;
  return async (message) => {
    if (!options.resendApiKey) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("RESEND_API_KEY is required in production");
      }
      devOutbox.push(message);
      if (devOutbox.length > DEV_OUTBOX_MAX) {
        devOutbox.shift();
      }
      logger.info(`(dev) to=${message.to} subject="${message.subject}"`);
      logger.info(message.text);
      return;
    }
    const res = await doFetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: options.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html ?? textToHtml(message.text),
      }),
    });
    if (!res.ok) {
      throw new Error(`Email send failed with ${res.status}`);
    }
  };
}
