import { PlusIcon } from "lucide-react";

import { opticalEdge } from "@/components/landing/display";
import { FAQ } from "@/lib/faq";
import { REPO } from "@/lib/landing";

const TITLE = "Questions, before you clone.";

/** Backticked spans become inline code. */
function Answer({ text }: { text: string }) {
  return text.split("`").map((part, i) =>
    i % 2 ? (
      <code
        className="rounded-chip bg-surface-2 px-1.5 py-0.5 font-mono text-[0.88em] text-foreground"
        key={part}
      >
        {part}
      </code>
    ) : (
      part
    )
  );
}

/**
 * Short answers to what people ask before cloning. Native <details>, so it
 * opens without JavaScript, find-in-page reveals answers, and crawlers see
 * every one; the same text feeds the FAQPage JSON-LD. The open/close motion
 * is CSS (`::details-content`) where the browser supports it.
 */
export function Faq() {
  return (
    <section
      aria-labelledby="faq-title"
      className="landing-section grid scroll-mt-8 gap-10"
      id="faq"
    >
      <div className="landing-head">
        <h2
          className="display-l max-w-[18ch]"
          id="faq-title"
          style={opticalEdge(TITLE)}
        >
          {TITLE}
        </h2>
        <p className="text-pretty text-muted-foreground">
          The short versions. The{" "}
          <a
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            href={`${REPO}#readme`}
          >
            README
          </a>{" "}
          has the long ones.
        </p>
      </div>

      <div className="faq border-border border-t">
        {FAQ.map(({ question, answer }) => (
          <details className="faq-item border-border border-b" key={question}>
            <summary className="faq-summary pressable-lg flex cursor-pointer select-none items-start justify-between gap-6 py-5 font-medium text-[18px] leading-7 sm:py-6">
              {question}
              <span className="flex h-7 shrink-0 items-center text-muted-foreground">
                <PlusIcon aria-hidden className="faq-icon size-5" />
              </span>
            </summary>
            <p className="max-w-[62ch] text-pretty pb-6 text-muted-foreground leading-7">
              <Answer text={answer} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
