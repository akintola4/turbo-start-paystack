import { render } from "@react-email/render";
import { createElement } from "react";

import { toPlainText } from "./content";
import { Email, urgentFallbackCss } from "./components/email";
import { msoHead } from "./components/kit";
import {
  type TemplateName,
  type TemplateProps,
  templates,
} from "./templates/index";
import { defaultTheme, type EmailTheme } from "./theme";

export type RenderedEmail = { subject: string; html: string; text: string };

/** Renders one template to its subject, HTML and plain-text alternative.
 *  Both parts come from the same `EmailContent`, so they can't disagree. */
export async function renderEmail<N extends TemplateName>(
  name: N,
  props: TemplateProps<N>,
  theme: EmailTheme = defaultTheme
): Promise<RenderedEmail> {
  const template = templates[name] as unknown as {
    subject: (p: TemplateProps<N>) => string;
    content: (
      p: TemplateProps<N>,
      t: EmailTheme
    ) => Parameters<typeof toPlainText>[0];
  };
  const content = template.content(props, theme);
  const html = await render(createElement(Email, { content, theme }));
  return {
    subject: template.subject(props),
    // React can't emit conditional comments; Outlook for Windows reads this
    // one to pin its fallback fonts.
    html: html.replace(
      "</head>",
      `${msoHead(urgentFallbackCss(theme))}</head>`
    ),
    text: toPlainText(content, theme),
  };
}
