"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const START_COMMAND = "npx degit akintola4/turbo-start-paystack my-saas";

/**
 * The install command as one dark bar. The mono text is sized to the bar
 * (container query units), so the whole command fits on one line from tablet
 * up; on narrow phones it wraps at token boundaries (and after the slash)
 * rather than being cut off. The Copy button stays on the bar's centre line,
 * and its label swaps in a reserved box, so "Copied" never moves anything.
 */
export function StartCommand() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(START_COMMAND);
      setCopied(true);
      toast.success("Copied the install command");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Select the command and copy it instead.");
    }
  };

  return (
    <div className="@container flex items-center gap-3 rounded-tile bg-[#0e1311] p-3 pl-5 text-[#e8efeb] shadow-[0_0_0_1px_#252e29] sm:gap-4 sm:p-4 sm:pl-7">
      <code
        className="min-w-0 flex-1 select-all font-mono text-[clamp(13px,calc((100cqw-170px)/30.5),40px)] leading-[1.35] tracking-normal"
        data-command
      >
        <span aria-hidden className="text-highlight">
          ${" "}
        </span>
        <span className="whitespace-nowrap">npx degit</span>{" "}
        <span className="whitespace-nowrap">akintola4/</span>
        <wbr />
        <span className="whitespace-nowrap">turbo-start-paystack</span>{" "}
        <span className="whitespace-nowrap text-[#a2aea8]">my-saas</span>
      </code>
      <button
        aria-label={copied ? "Copied" : "Copy the install command"}
        className="grid h-12 shrink-0 touch-manipulation place-items-center rounded-control bg-highlight px-3 font-semibold text-highlight-foreground transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-highlight-hover active:scale-[0.97] sm:h-14 sm:px-5"
        data-copy
        onClick={copy}
        type="button"
      >
        {/* Both labels share one grid cell, so the button keeps the width of
            the wider one and never shifts. */}
        <span className="grid [&>*]:col-start-1 [&>*]:row-start-1">
          <span
            className={cn(
              "inline-flex items-center gap-2 transition-opacity duration-(--dur-fast)",
              copied && "opacity-0"
            )}
          >
            <CopyIcon aria-hidden className="size-4" />
            <span className="max-sm:sr-only">Copy</span>
          </span>
          <span
            aria-hidden={!copied}
            className={cn(
              "inline-flex items-center gap-2 transition-opacity duration-(--dur-fast)",
              !copied && "opacity-0"
            )}
          >
            <CheckIcon aria-hidden className="size-4" />
            <span className="max-sm:sr-only">Copied</span>
          </span>
        </span>
      </button>
    </div>
  );
}
