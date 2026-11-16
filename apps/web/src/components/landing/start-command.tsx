"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AGENT_LOGOS, AgentLogo } from "@/components/landing/agent-logos";
import { Segmented, type SegmentOption } from "@/components/landing/segmented";
import {
  AGENT_PROMPT,
  AGENT_PROMPT_LINES,
  INSTALL_COMMAND,
  INSTALL_STEPS,
} from "@/lib/landing";
import { toast } from "@/lib/toast";

/** How long the button says "Copied" before it goes back to "Copy". */
const COPIED_MS = 1600;

/** How a visitor starts: the shell command, or a prompt for their agent. */
export type StartWith = "terminal" | "agent";

const START_WITH: Record<
  StartWith,
  { text: string; name: string; copied: string }
> = {
  terminal: {
    text: INSTALL_COMMAND,
    name: "Copy the install command",
    copied: "Copied the install command",
  },
  agent: {
    text: AGENT_PROMPT,
    name: "Copy the prompt for your agent",
    copied: "Copied the prompt for your agent",
  },
};

const START_OPTIONS: readonly SegmentOption<StartWith>[] = [
  { value: "terminal", label: "Terminal" },
  { value: "agent", label: "Your agent" },
];

/** The last choice, per browser. Storage can be missing or blocked, so every
 *  read and write is guarded and the terminal is the fallback. */
const START_WITH_KEY = "tsp-start-with";
const START_WITH_EVENT = "tsp-start-with";

function readStartWith(): StartWith {
  try {
    return localStorage.getItem(START_WITH_KEY) === "agent"
      ? "agent"
      : "terminal";
  } catch {
    return "terminal";
  }
}

function subscribeStartWith(onChange: () => void) {
  window.addEventListener(START_WITH_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(START_WITH_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The remembered choice; the server and first paint use the terminal. */
function useStartWith() {
  const value = useSyncExternalStore(
    subscribeStartWith,
    readStartWith,
    () => "terminal" as const
  );
  const set = (next: StartWith) => {
    try {
      localStorage.setItem(START_WITH_KEY, next);
    } catch {
      // Not remembered; the switch still works for this visit.
    }
    window.dispatchEvent(new Event(START_WITH_EVENT));
  };
  return [value, set] as const;
}

/** Copies one of the start texts; `copied` is true for a moment afterwards. */
function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (what: StartWith) => {
    try {
      await navigator.clipboard.writeText(START_WITH[what].text);
      setCopied(true);
      toast.success(START_WITH[what].copied);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
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

/** Numbered steps hang their wrapped lines under the text, and an indented
 *  line continues the step above it, so the prompt reads as a list. */
function promptLineClass(line: string) {
  if (/^\d+\. /.test(line)) {
    return "block pl-[3ch] -indent-[3ch]";
  }
  if (line.startsWith(" ")) {
    return "block pl-[3ch]";
  }
  return "block";
}

/** The copy button's two labels in one centred grid cell: the button takes
 *  the width of the wider one and the swap never moves anything. */
function CopyLabels({ copied, idle }: { copied: boolean; idle: string }) {
  return (
    <span className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
      <CopyLabel icon={CopyIcon} shown={!copied} text={idle} />
      <CopyLabel icon={CheckIcon} shown={copied} text="Copied" />
    </span>
  );
}

/**
 * The receipt's "Pay with" block: a Terminal | Your agent switch, the text
 * it copies (the install steps one per line, or the agent prompt), and the
 * Copy button. The choice is remembered, and the hero's agent button sets it.
 */
export function InstallCommand() {
  const { copied, copy } = useCopy();
  const [startWith, setStartWith] = useStartWith();
  return (
    <div className="grid gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="hidden text-[13px] text-[var(--receipt-muted)] no-js:inline">
          Pay with
        </span>
        <Segmented
          className="w-max no-js:hidden"
          label="Pay with"
          onChange={setStartWith}
          options={START_OPTIONS}
          tone="paper"
          value={startWith}
        />
        <button
          aria-label={copied ? "Copied" : START_WITH[startWith].name}
          className="pressable grid h-11 shrink-0 place-items-center rounded-control bg-highlight px-4 font-semibold text-highlight-foreground hover:bg-highlight-hover no-js:hidden"
          data-copy
          onClick={() => copy(startWith)}
          type="button"
        >
          <CopyLabels copied={copied} idle="Copy" />
        </button>
      </div>
      <code
        className="grid min-w-0 gap-0.5 rounded-[10px] bg-[var(--receipt-well)] px-4 py-3 font-mono text-[13px] leading-5"
        data-command={startWith}
      >
        {startWith === "terminal"
          ? INSTALL_STEPS.map((step) => (
              <span className="block pl-[2ch] -indent-[2ch]" key={step}>
                <span
                  aria-hidden
                  className="select-none text-[var(--receipt-muted)]"
                >
                  ${" "}
                </span>
                <Tokens step={step} />
              </span>
            ))
          : AGENT_PROMPT_LINES.map((line) => (
              <span className={promptLineClass(line)} key={line}>
                <Tokens step={line.trim()} />
              </span>
            ))}
      </code>
    </div>
  );
}

/**
 * The hero's shortcut, after robotostudio.com/contact: a bordered chip with
 * the agents it works with, the action, and a copy icon that turns into a
 * tick. One press copies the agent prompt and remembers "Your agent", so the
 * receipt at the bottom opens on the same prompt.
 */
export function AgentPromptButton({ className }: { className?: string }) {
  const { copied, copy } = useCopy();
  const [, setStartWith] = useStartWith();
  return (
    <button
      aria-label={copied ? "Copied" : START_WITH.agent.name}
      className={cn(
        "pressable group inline-flex min-h-11.5 items-center gap-2 rounded-control border border-panel-line bg-panel-tile px-3 text-panel-foreground text-xs min-[370px]:text-sm transition-[background-color,border-color,scale] hover:border-panel-muted/40 hover:bg-panel-line no-js:hidden",
        className
      )}
      data-agent-copy
      data-copied={copied}
      onClick={() => {
        setStartWith("agent");
        copy("agent");
      }}
      type="button"
    >
      <span
        aria-hidden
        className="grid shrink-0 grid-flow-col gap-1 max-[340px]:hidden"
      >
        {AGENT_LOGOS.map((logo) => (
          <span
            className="grid size-6 place-items-center rounded-[6px] bg-panel inset-ring inset-ring-panel-line"
            key={logo.name}
            title={logo.name}
          >
            <AgentLogo path={logo.path} />
          </span>
        ))}
      </span>
      <span className="[text-box:trim-both_cap_alphabetic]">
        Copy a prompt for your agent
      </span>
      <span
        aria-hidden
        className="ml-auto grid place-items-center text-panel-muted [&>*]:col-start-1 [&>*]:row-start-1"
      >
        <CopyIcon
          className={cn(
            "size-4 transition-[opacity,scale,filter] duration-(--dur-base) ease-(--ease-out) motion-reduce:transition-none",
            copied && "scale-[0.85] opacity-0 blur-[2px]"
          )}
        />
        <CheckIcon
          className={cn(
            "size-4 text-panel-foreground transition-[opacity,scale,filter] duration-(--dur-base) ease-(--ease-out) motion-reduce:transition-none",
            !copied && "scale-[0.85] opacity-0 blur-[2px]"
          )}
        />
      </span>
    </button>
  );
}
