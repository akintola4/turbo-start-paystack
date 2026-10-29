"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { INSTALL_COMMAND, INSTALL_STEPS } from "@/lib/landing";

/** How long the button says "Copied" before it goes back to "Copy". */
const COPIED_MS = 1600;

/** Copies the install command; `copied` is true for a moment afterwards. */
function useCopyCommand() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      toast.success("Copied the install command");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      toast.error("Couldn't copy. Select the command and copy it instead.");
    }
  };
  return { copied, copy };
}

/**
 * One state of the copy button: icon and word, centred on the word's cap
 * height. The hidden state is scaled down and blurred a little, so the swap
 * reads as one thing changing rather than two crossfading.
 */
function CopyLabel({
  icon: Icon,
  text,
  shown,
}: {
  icon: typeof CopyIcon;
  text: string;
  shown: boolean;
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
      <span className="[text-box:trim-both_cap_alphabetic]">{text}</span>
    </span>
  );
}

/** Splits a step at spaces and after slashes, so a narrow phone wraps the
 *  command at a token boundary instead of mid-word. */
function Tokens({ step }: { step: string }) {
  const words = step.split(" ");
  return words.map((word, i) => (
    <span key={`${word}-${i}`}>
      {word.split("/").map((part, j, parts) => (
        <span className="whitespace-nowrap" key={`${part}-${j}`}>
          {part}
          {j < parts.length - 1 ? (
            <>
              /<wbr />
            </>
          ) : null}
        </span>
      ))}
      {i < words.length - 1 ? " " : null}
    </span>
  ));
}

/**
 * The install steps as they appear on the receipt, one per line, and the
 * Copy button that puts all of them on the clipboard as one line. The label
 * swaps inside a reserved box, so "Copied" never moves anything.
 */
export function InstallCommand() {
  const { copied, copy } = useCopyCommand();
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--receipt-muted)]">
          Pay with
        </span>
        <button
          aria-label={copied ? "Copied" : "Copy the install command"}
          className="pressable grid h-11 shrink-0 place-items-center rounded-control bg-highlight px-4 font-semibold text-highlight-foreground hover:bg-highlight-hover"
          data-copy
          onClick={copy}
          type="button"
        >
          {/* Both labels share one centred grid cell: the button takes the
              width of the wider one and the swap never moves anything. */}
          <span className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
            <CopyLabel icon={CopyIcon} shown={!copied} text="Copy" />
            <CopyLabel icon={CheckIcon} shown={copied} text="Copied" />
          </span>
        </button>
      </div>
      <code
        className="grid min-w-0 gap-0.5 rounded-[10px] bg-[var(--receipt-well)] px-4 py-3 font-mono text-[13px] leading-5"
        data-command
      >
        {INSTALL_STEPS.map((step) => (
          <span className="block pl-[2ch] -indent-[2ch]" key={step}>
            <span
              aria-hidden
              className="select-none text-[var(--receipt-muted)]"
            >
              ${" "}
            </span>
            <Tokens step={step} />
          </span>
        ))}
      </code>
    </div>
  );
}
