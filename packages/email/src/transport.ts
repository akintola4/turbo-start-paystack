import { Logger } from "@workspace/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Sent as Resend's `Idempotency-Key` (1–256 chars; Resend remembers it
   *  for 24 hours and won't send the same key twice). */
  idempotencyKey?: string;
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

/** Fallback HTML for a message sent without a template. */
export function textToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1">$1</a>')
    .replaceAll("\n", "<br>");
}

/**
 * Sends through Resend's HTTP API when `resendApiKey` is set. Without it the
 * message goes to the dev outbox and a log line; that fallback refuses to run
 * when NODE_ENV is production (so mail is never silently dropped there)
 * unless `allowLogInProduction` is set explicitly (EMAIL_TRANSPORT=log), which
 * is only meant for running a production build locally.
 */
export function createEmailSender(options: {
  from: string;
  resendApiKey?: string;
  fetch?: typeof fetch;
  allowLogInProduction?: boolean;
}): EmailSender {
  const doFetch = options.fetch ?? fetch;
  const apiKey = options.resendApiKey;
  return async (message) => {
    if (apiKey) {
      await postToResend(doFetch, apiKey, options.from, message);
      return;
    }
    if (
      process.env.NODE_ENV === "production" &&
      !options.allowLogInProduction
    ) {
      throw new Error("RESEND_API_KEY is required in production");
    }
    logToOutbox(message);
  };
}

function logToOutbox(message: EmailMessage) {
  devOutbox.push(message);
  if (devOutbox.length > DEV_OUTBOX_MAX) {
    devOutbox.shift();
  }
  logger.info(`(dev) to=${message.to} subject="${message.subject}"`);
  logger.info(message.text);
}

async function postToResend(
  doFetch: typeof fetch,
  apiKey: string,
  from: string,
  message: EmailMessage
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (message.idempotencyKey) {
    headers["Idempotency-Key"] = message.idempotencyKey.slice(0, 256);
  }
  const res = await doFetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html ?? textToHtml(message.text),
    }),
  });
  if (!res.ok) {
    // Resend's error body names the problem (e.g. an unverified domain);
    // it never echoes the API key.
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Email send failed with ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }
}
