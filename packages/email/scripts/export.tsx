/**
 * Renders every template with its sample props to `<outDir>/<name>.html`
 * and `.txt`, for screenshots and eyeballing the plain-text part.
 *
 *   pnpm --filter @workspace/email export /tmp/emails
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { renderEmail } from "../src/render";
import { type TemplateName, templates } from "../src/templates/index";
import { createTheme } from "../src/theme";

const outDir = resolve(process.argv[2] ?? "out");
await mkdir(outDir, { recursive: true });
const theme = createTheme({ supportUrl: "mailto:support@example.com" });

for (const name of Object.keys(templates) as TemplateName[]) {
  const props = templates[name].Component.PreviewProps;
  const email = await renderEmail(name, props as never, theme);
  await writeFile(join(outDir, `${name}.html`), email.html);
  await writeFile(
    join(outDir, `${name}.txt`),
    `Subject: ${email.subject}\n\n${email.text}\n`
  );
  console.log(`${name}: ${email.subject}`);
}
