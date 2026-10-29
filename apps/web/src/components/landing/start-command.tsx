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
/** Copies the install command; `copied` is true for 1.6s afterwards. */
export function useCopyCommand() {
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
  return { copied, copy };
}

/**
 * One state of a copy button: icon and word, centred on the word's cap
 * height. The hidden state is scaled down and blurred a little, so the swap
 * reads as one thing changing rather than two crossfading.
 */
export function CopyLabel({
  icon: Icon,
  text,
  shown,
  hideTextOnPhone = true,
}: {
  icon: typeof CopyIcon;
  text: string;
  shown: boolean;
  hideTextOnPhone?: boolean;
}) {
  return (
    <span
      aria-hidden={!shown}
      className={cn(
        "inline-flex items-center gap-1.5 transition-[opacity,scale,filter] duration-(--dur-base) ease-(--ease-out) motion-reduce:transition-none",
        shown
          ? "scale-100 opacity-100 blur-0"
          : "scale-[0.85] opacity-0 blur-[2px]"
      )}
      data-copy-label={text}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {text ? (
        <span
          className={cn(
            "[text-box:trim-both_cap_alphabetic]",
            hideTextOnPhone && "max-sm:sr-only"
          )}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}

export function StartCommand() {
  const { copied, copy } = useCopyCommand();

  return (
    <div className="@container flex items-center gap-3 rounded-tile bg-[var(--neutral-950)] p-3 pl-5 text-[var(--neutral-100)] shadow-[0_0_0_1px_var(--neutral-800)] sm:gap-4 sm:p-4 sm:pl-7">
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
        <span className="whitespace-nowrap text-[var(--neutral-400)]">
          my-saas
        </span>
      </code>
      <button
        aria-label={copied ? "Copied" : "Copy the install command"}
        className="pressable grid h-12 shrink-0 place-items-center rounded-control bg-highlight px-3 font-semibold text-highlight-foreground hover:bg-highlight-hover sm:h-14 sm:px-5"
        data-copy
        onClick={copy}
        type="button"
      >
        {/* Both labels share one centred grid cell: the button takes the
            width of the wider one, both sit centred, and the swap never
            moves anything. */}
        <span className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
          <CopyLabel icon={CopyIcon} shown={!copied} text="Copy" />
          <CopyLabel icon={CheckIcon} shown={copied} text="Copied" />
        </span>
      </button>
    </div>
  );
}
