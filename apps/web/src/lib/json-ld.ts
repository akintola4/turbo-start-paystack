import type { Graph } from "schema-dts";

import { FAQ, plainAnswer } from "@/lib/faq";
import { REPO } from "@/lib/landing";

const NAME = "Turbo Start Paystack";
const DESCRIPTION =
  "A free, MIT-licensed Next.js starter for selling subscriptions across Africa: organizations, roles and Paystack billing in naira, cedis, rand, shillings and dollars.";

/**
 * Structured data for the landing page: the site, the starter itself as
 * source code, and the FAQ section word for word. There's no search or
 * pricing of our own here (the prices on the page are the demo product's),
 * so nothing claims those. Without a known site URL the nodes drop their
 * URLs rather than guess one.
 */
export function landingJsonLd(siteUrl?: string): Graph {
  const site = siteUrl?.replace(/\/+$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        ...(site ? { "@id": `${site}/#website`, url: `${site}/` } : {}),
        name: NAME,
        description: DESCRIPTION,
        inLanguage: "en",
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${REPO}#code`,
        name: NAME,
        description: DESCRIPTION,
        codeRepository: REPO,
        license: "https://opensource.org/licenses/MIT",
        programmingLanguage: "TypeScript",
        runtimePlatform: "Node.js",
        keywords: [
          "Next.js",
          "Paystack",
          "SaaS starter",
          "subscriptions",
          "Better Auth",
          "Drizzle",
        ],
        ...(site
          ? {
              url: `${site}/`,
              image: `${site}/opengraph-image`,
              isPartOf: { "@id": `${site}/#website` },
            }
          : {}),
      },
      {
        "@type": "FAQPage",
        ...(site ? { "@id": `${site}/#faq`, url: `${site}/` } : {}),
        mainEntity: FAQ.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: plainAnswer(answer) },
        })),
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">, safe against `</script>`. */
export function serializeJsonLd(data: Graph): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
