import { render, type toPlainText } from "@react-email/render";
import { type ComponentType, createElement } from "react";

import {
  type TemplateName,
  type TemplateProps,
  templates,
} from "./templates/index";
import { defaultTheme, type EmailTheme } from "./theme";

/** Plain-text tweaks: keep heading case, and "Label: value" for detail
 *  rows instead of the two cells run together. */
const htmlToTextOptions = {
  formatters: {
    detailLabel: (
      elem: { children: unknown[] },
      walk: (nodes: unknown[], builder: unknown) => void,
      builder: { addInline: (text: string) => void }
    ) => {
      walk(elem.children, builder);
      builder.addInline(": ");
    },
  },
  selectors: [
    { selector: "h1", options: { uppercase: false } },
    { selector: "td.em-label", format: "detailLabel" },
  ],
} as unknown as Parameters<typeof toPlainText>[1];

export type RenderedEmail = { subject: string; html: string; text: string };

/** Renders one template to its subject, HTML and plain-text alternative. */
export async function renderEmail<N extends TemplateName>(
  name: N,
  props: TemplateProps<N>,
  theme: EmailTheme = defaultTheme
): Promise<RenderedEmail> {
  const template = templates[name] as unknown as {
    Component: ComponentType<Record<string, unknown>>;
    subject: (p: TemplateProps<N>) => string;
  };
  const element = createElement(template.Component, { ...props, theme });
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true, htmlToTextOptions }),
  ]);
  return { subject: template.subject(props), html, text };
}
