/**
 * Renders every template with its sample props (plus a few extra states) to
 * `<outDir>/<name>.html` and `.txt`, for screenshots and for reading the
 * plain-text part.
 *
 *   pnpm --filter @workspace/email export /tmp/emails
 *
 * Fonts and icons are referenced from https://app.example.com/email; the
 * screenshot script serves them from apps/web/public/email.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { renderEmail } from "../src/render";
import { type TemplateName, templates } from "../src/templates/index";
import { createTheme } from "../src/theme";

export const SAMPLE_ASSETS_URL = "https://app.example.com/email";

/** Extra states worth seeing next to the defaults. */
const variants: {
  name: TemplateName;
  slug: string;
  props: Record<string, unknown>;
}[] = [
  {
    name: "plan-changed",
    slug: "plan-changed-downgrade",
    props: {
      change: "downgrade",
      fromPlan: "Pro (monthly)",
      toPlan: "Starter (monthly)",
      chargedSubunit: 0,
      effectiveAt: new Date("2026-11-12T09:00:00Z"),
    },
  },
  {
    name: "payment-receipt",
    slug: "payment-receipt-kes",
    props: { currency: "KES", amountSubunit: 390_000, interval: "annually" },
  },
];

export async function exportAll(outDir: string) {
  await mkdir(outDir, { recursive: true });
  const theme = createTheme({
    supportUrl: "mailto:support@turbostart.ng",
    assetsUrl: SAMPLE_ASSETS_URL,
  });
  const jobs = [
    ...(Object.keys(templates) as TemplateName[]).map((name) => ({
      name,
      slug: name as string,
      props: templates[name].Component.PreviewProps as Record<string, unknown>,
    })),
    ...variants.map((v) => ({
      ...v,
      props: { ...templates[v.name].Component.PreviewProps, ...v.props },
    })),
  ];
  const slugs: string[] = [];
  for (const job of jobs) {
    const email = await renderEmail(job.name, job.props as never, theme);
    await writeFile(join(outDir, `${job.slug}.html`), email.html);
    await writeFile(
      join(outDir, `${job.slug}.txt`),
      `Subject: ${email.subject}\n\n${email.text}`
    );
    const kb = (Buffer.byteLength(email.html) / 1024).toFixed(1);
    console.log(`${job.slug}: ${kb} KB  ${email.subject}`);
    slugs.push(job.slug);
  }
  return slugs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await exportAll(resolve(process.argv[2] ?? "out"));
}
