/**
 * Sends every template (with its sample props, plus the extra states the
 * export script renders) to one inbox through Resend, so the designs can be
 * checked in real clients: Gmail, Outlook and Apple Mail, light and dark.
 *
 *   pnpm --filter @workspace/email send-test --to you@example.com --inline
 *   pnpm --filter @workspace/email send-test --to you@example.com --only payment-receipt,payment-failed
 *
 * Reads RESEND_API_KEY and EMAIL_FROM from apps/web/.env. Without a verified
 * domain, Resend only delivers from onboarding@resend.dev to the address the
 * Resend account was created with.
 *
 * Icons and fonts normally load from `${assetsUrl}`, which mail clients fetch
 * through their own proxies, so it must be public (EMAIL_TEST_ASSETS_URL or
 * --assets-url, e.g. a preview deploy's /email). Before the app is deployed,
 * pass --inline: the status icons are attached to each message and referenced
 * by Content-ID, so they show without any hosting. Fonts can't be inlined, so
 * those clients use the fallback stack, which is what Gmail does anyway.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";

import { renderEmail } from "../src/render";
import { createTheme } from "../src/theme";
import { SAMPLE_ASSETS_URL, sampleJobs } from "./export";

const { values } = parseArgs({
  options: {
    to: { type: "string" },
    only: { type: "string" },
    "assets-url": { type: "string" },
    inline: { type: "boolean", default: false },
    "delay-ms": { type: "string" },
  },
});

const to = values.to;
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error(
    "Usage: send-test --to you@example.com [--inline] [--only a,b] [--assets-url https://…/email] [--delay-ms 3000]"
  );
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error(
    "RESEND_API_KEY is not set. Add it to apps/web/.env (it is never printed)."
  );
  process.exit(1);
}

const from = process.env.EMAIL_FROM ?? "Turbo Start <onboarding@resend.dev>";
const assetsUrl =
  values["assets-url"] ??
  process.env.EMAIL_TEST_ASSETS_URL ??
  SAMPLE_ASSETS_URL;
const only = values.only
  ?.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Resend allows 2 requests a second; sending slower also looks less like a
// burst to spam filters.
const delayMs = Math.max(600, Number(values["delay-ms"] ?? 3000) || 3000);

/** Where `${assetsUrl}/…` lives on disk, for --inline. */
const PUBLIC_EMAIL_DIR = resolve(
  import.meta.dirname,
  "../../../apps/web/public/email"
);

type Attachment = { filename: string; content: string; content_id: string };

/** Swaps every `${assetsUrl}/icons/<name>.png` for a cid: reference and
 *  returns the matching attachments. */
async function inlineIcons(
  html: string
): Promise<{ html: string; attachments: Attachment[] }> {
  const prefix = `${assetsUrl.replace(/\/$/, "")}/icons/`;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = [
    ...new Set(
      [...html.matchAll(new RegExp(`${escaped}([a-z0-9-]+\\.png)`, "g"))].map(
        (m) => m[1] as string
      )
    ),
  ];
  const attachments: Attachment[] = [];
  let out = html;
  for (const name of names) {
    const cid = name.replace(/\.png$/, "");
    const content = (
      await readFile(resolve(PUBLIC_EMAIL_DIR, "icons", name))
    ).toString("base64");
    attachments.push({ filename: name, content, content_id: cid });
    out = out.replaceAll(`${prefix}${name}`, `cid:${cid}`);
  }
  return { html: out, attachments };
}

async function send(message: {
  subject: string;
  html: string;
  text: string;
  attachments: Attachment[];
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.attachments.length
        ? { attachments: message.attachments }
        : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

const theme = createTheme({ assetsUrl });
const jobs = sampleJobs().filter((j) => !only || only.includes(j.slug));
if (jobs.length === 0) {
  console.error(`Nothing matches --only ${values.only}`);
  process.exit(1);
}

console.log(`Sending ${jobs.length} test emails to ${to} from ${from}`);
if (values.inline) {
  console.log("Icons: attached inline (cid:). Fonts: fallback stack.");
} else if (assetsUrl === SAMPLE_ASSETS_URL) {
  console.log(
    "Assets: placeholder URL, so icons show as broken images. Pass --inline or --assets-url."
  );
}

let failed = 0;
for (const [i, job] of jobs.entries()) {
  const email = await renderEmail(job.name, job.props as never, theme);
  const subject = `[test ${i + 1}/${jobs.length}] ${email.subject}`;
  try {
    const { html, attachments } = values.inline
      ? await inlineIcons(email.html)
      : { html: email.html, attachments: [] };
    await send({ subject, html, text: email.text, attachments });
    console.log(
      `  sent  ${job.slug}${attachments.length ? ` (${attachments.length} inline icon${attachments.length === 1 ? "" : "s"})` : ""}`
    );
  } catch (error) {
    failed++;
    console.error(
      `  FAIL  ${job.slug}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (i < jobs.length - 1) await new Promise((r) => setTimeout(r, delayMs));
}

process.exit(failed ? 1 : 0);
