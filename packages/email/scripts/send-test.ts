/**
 * Sends every template (with its sample props, plus the extra states the
 * export script renders) to one inbox through Resend, so the designs can be
 * checked in real clients: Gmail, Outlook and Apple Mail, light and dark.
 *
 *   pnpm --filter @workspace/email send-test --to you@example.com
 *   pnpm --filter @workspace/email send-test --to you@example.com --only payment-receipt,payment-failed
 *
 * Reads RESEND_API_KEY and EMAIL_FROM from apps/web/.env. Without a verified
 * domain, Resend only delivers from onboarding@resend.dev to the address the
 * Resend account was created with.
 *
 * Fonts and icons load from EMAIL_TEST_ASSETS_URL (or --assets-url), which
 * must be publicly reachable: mail clients fetch images through their own
 * proxies, so localhost won't work. Without it, icons fall back to their alt
 * text and fonts to the fallback stack, which is still a useful test.
 */
import { parseArgs } from "node:util";

import { renderEmail } from "../src/render";
import { createTheme } from "../src/theme";
import { createEmailSender } from "../src/transport";
import { SAMPLE_ASSETS_URL, sampleJobs } from "./export";

const { values } = parseArgs({
  options: {
    to: { type: "string" },
    only: { type: "string" },
    "assets-url": { type: "string" },
  },
});

const to = values.to;
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error(
    "Usage: send-test --to you@example.com [--only a,b] [--assets-url https://…/email]"
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

const theme = createTheme({ assetsUrl });
const send = createEmailSender({ from, resendApiKey: apiKey });
const jobs = sampleJobs().filter((j) => !only || only.includes(j.slug));
if (jobs.length === 0) {
  console.error(`Nothing matches --only ${values.only}`);
  process.exit(1);
}

console.log(`Sending ${jobs.length} test emails to ${to} from ${from}`);
if (assetsUrl === SAMPLE_ASSETS_URL) {
  console.log(
    "Assets: placeholder URL, so icons show alt text and fonts use the fallback stack."
  );
}

let failed = 0;
for (const [i, job] of jobs.entries()) {
  const email = await renderEmail(job.name, job.props as never, theme);
  const subject = `[test ${i + 1}/${jobs.length}] ${email.subject}`;
  try {
    await send({ to, subject, html: email.html, text: email.text });
    console.log(`  sent  ${job.slug}`);
  } catch (error) {
    failed++;
    console.error(
      `  FAIL  ${job.slug}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  // Resend's default rate limit is 2 requests per second.
  await new Promise((r) => setTimeout(r, 600));
}

process.exit(failed ? 1 : 0);
