import { describe, expect, it } from "vitest";

import { FAQ } from "../src/lib/faq";
import { landingJsonLd, serializeJsonLd } from "../src/lib/json-ld";
import { REPO } from "../src/lib/landing";

describe("landing JSON-LD", () => {
  it("describes the site and the starter, linked by @id", () => {
    const data = landingJsonLd("https://example.test/");
    const [site, code] = data["@graph"];
    expect(site).toMatchObject({
      "@type": "WebSite",
      "@id": "https://example.test/#website",
      url: "https://example.test/",
    });
    expect(code).toMatchObject({
      "@type": "SoftwareSourceCode",
      codeRepository: REPO,
      license: "https://opensource.org/licenses/MIT",
      image: "https://example.test/opengraph-image",
      isPartOf: { "@id": "https://example.test/#website" },
    });
  });

  it("carries every FAQ question, with answers as plain text", () => {
    const faq = landingJsonLd("https://example.test")["@graph"].find(
      (node) => (node as { "@type": string })["@type"] === "FAQPage"
    ) as unknown as {
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(faq.mainEntity.map((q) => q.name)).toEqual(
      FAQ.map((f) => f.question)
    );
    for (const q of faq.mainEntity) {
      expect(q.acceptedAnswer.text).not.toContain("`");
    }
    expect(faq.mainEntity[1]?.acceptedAnswer.text).toContain(
      "pnpm setup runs a local Paystack mock"
    );
  });

  it("leaves URLs out when the site URL is unknown", () => {
    const json = JSON.stringify(landingJsonLd(undefined));
    expect(json).not.toContain("#website");
    expect(json).not.toContain("opengraph-image");
    expect(json).toContain(REPO);
  });

  it("can't close its own script tag", () => {
    const out = serializeJsonLd({
      "@context": "https://schema.org",
      "@graph": [{ "@type": "Thing", name: "</script><script>alert(1)" }],
    });
    expect(out).not.toContain("<");
    expect(JSON.parse(out)["@graph"][0].name).toBe("</script><script>alert(1)");
  });
});
