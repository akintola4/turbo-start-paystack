"use client";

import { useRef } from "react";

import {
  type MarkSignal,
  useMarkListener,
} from "@/components/auth/mark-signals";
import {
  GRID,
  type MarkSlot,
  markCode,
  markGrid,
  radiusOf,
  slotKey,
} from "@/lib/mark";

export type AuthPanelProps = {
  /** Which page the panel sits beside. */
  variant: "sign-in" | "sign-up";
  /** The visitor's likely currency (ISO code). The mark is drawn from the
   *  email alone, so it doesn't use this. */
  currency?: string;
};

type Variant = AuthPanelProps["variant"];
type Values = { email: string; name: string };

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";
/** The tile settling into place: a small overshoot, then rest. */
const EASE_SETTLE = "cubic-bezier(0.34, 1.36, 0.64, 1)";

const COPY = {
  "sign-in": {
    label: "Your mark",
    note: "Same email, same mark, on every device.",
    empty: "Your mark draws itself from your email.",
    done: "Recognise it? This one is yours.",
    pending: "Checking it's you…",
    error: "That mark doesn't match. Check the password.",
  },
  "sign-up": {
    label: "Your workspace's mark",
    note: "Drawn from your email, here in your browser.",
    empty: "Every workspace gets a mark, drawn from your email.",
    done: "This is your workspace's mark.",
    pending: "Setting your mark…",
    error: "Almost. Check the form and try again.",
  },
} as const;

function caption(variant: Variant, email: string, state: string) {
  const copy = COPY[variant];
  if (state === "error") {
    return copy.error;
  }
  if (!email) {
    return copy.empty;
  }
  if (state === "pending") {
    return copy.pending;
  }
  return email.length < 6 ? "Keep going…" : copy.done;
}

/** What the workspace chip says once the mark has become its icon. */
function chipText(variant: Variant, { email, name }: Values) {
  if (variant === "sign-up") {
    const first = (name || email.split("@")[0] || "Your").split(" ")[0];
    return {
      name: `${first}'s workspace`,
      sub: "Verify your email to open it",
    };
  }
  const domain = email.split("@")[1]?.split(".")[0] || "workspace";
  return {
    name: domain.charAt(0).toUpperCase() + domain.slice(1),
    sub: `Signed in as ${email}`,
  };
}

function reduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Sets a cell to a slot's shape; animates it in unless motion is off. */
function paint(el: HTMLElement, slot: MarkSlot, delay: number) {
  const key = slotKey(slot);
  if (el.dataset.key === key) {
    return;
  }
  el.dataset.key = key;
  el.dataset.colour = slot?.colour ?? "seed";
  el.dataset.glyph = slot?.kind === "glyph" ? slot.glyph : "";
  el.style.borderRadius = slot ? radiusOf(slot, "var(--rad)") : "";
  el.textContent = slot?.kind === "glyph" ? slot.glyph : "";
  if (reduced()) {
    return;
  }
  el.animate(
    slot
      ? [
          { transform: "scale(0.55) rotate(-8deg)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ]
      : [
          { transform: "scale(0.6)", opacity: 0.4 },
          { transform: "scale(0.14)", opacity: 1 },
        ],
    {
      duration: slot ? 460 : 220,
      delay,
      easing: slot ? EASE_SETTLE : EASE_OUT,
      fill: "backwards",
    }
  );
}

/**
 * The auth pages' panel, concept "Your mark". As the email is typed, a
 * mirrored 5×5 mark draws itself from a hash of it (lib/mark.ts): one shape
 * per keystroke, brand radii, currency glyphs, and one sunflower cell that
 * says "yours". A wrong password shakes it and turns that cell red; success
 * shrinks it into a workspace icon with the name below.
 *
 * Decoration only: aria-hidden, nothing focusable, no React state. It
 * listens to AuthForm's signals (mark-signals.ts) and paints with refs and
 * WAAPI, transform and opacity only, with a still for reduced motion. The
 * email stays in the browser. Desktop: the forest panel beside the form;
 * phones: a slim band above it.
 */
export function AuthPanel({ variant }: AuthPanelProps) {
  const panel = useRef<HTMLElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const code = useRef<HTMLSpanElement>(null);
  const chipName = useRef<HTMLSpanElement>(null);
  const chipSub = useRef<HTMLSpanElement>(null);
  const shrink = useRef<Animation | null>(null);
  const state = useRef<"idle" | "pending" | "error" | "success">("idle");
  const copy = COPY[variant];

  const shapes = () => [
    ...(mark.current?.querySelectorAll<HTMLElement>("[data-shape]") ?? []),
  ];

  function draw(email: string) {
    const grid = markGrid(email);
    shapes().forEach((el, i) => {
      // The mirror cell lands a beat after its source.
      paint(el, grid[i] ?? null, i % GRID > 2 ? 40 : 0);
    });
    if (code.current) {
      code.current.textContent = markCode(email);
    }
  }

  function setLine(text: string) {
    const el = line.current;
    // The target text, so quick successive changes land on the last one.
    if (!el || (el.dataset.target ?? el.textContent) === text) {
      return;
    }
    el.dataset.target = text;
    if (reduced()) {
      el.textContent = text;
      return;
    }
    el.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(4px)" }], {
      duration: 140,
      easing: "cubic-bezier(0.4, 0, 1, 1)",
      fill: "forwards",
    }).onfinish = (event) => {
      (event.target as Animation).cancel();
      el.textContent = el.dataset.target ?? text;
      el.animate(
        [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1 }],
        { duration: 180, easing: EASE_OUT }
      );
    };
  }

  function ripple() {
    const cells = mark.current?.children;
    if (!cells || reduced()) {
      return;
    }
    [...cells].forEach((cell, i) => {
      const d = Math.hypot(Math.floor(i / GRID) - 2, (i % GRID) - 2);
      cell.animate(
        [
          { transform: "none" },
          { transform: "scale(0.86)" },
          { transform: "none" },
        ],
        { duration: 520, delay: d * 70, easing: EASE_IN_OUT }
      );
    });
  }

  function shake() {
    if (reduced()) {
      return;
    }
    mark.current?.animate(
      [
        { translate: "0" },
        { translate: "-10px" },
        { translate: "8px" },
        { translate: "-5px" },
        { translate: "2px" },
        { translate: "0" },
      ],
      { duration: 420, easing: EASE_OUT }
    );
  }

  function succeed(values: Values) {
    const chip = chipText(variant, values);
    if (chipName.current && chipSub.current) {
      chipName.current.textContent = chip.name;
      chipSub.current.textContent = chip.sub;
    }
    panel.current?.setAttribute("data-state", "success");
    const el = mark.current;
    // On the phone band the mark is already icon-sized: it stays put.
    if (!el || window.matchMedia("(max-width: 1023px)").matches) {
      return;
    }
    const size = el.getBoundingClientRect().height;
    shrink.current = el.animate(
      [
        { transform: "none" },
        { transform: `translateY(${-size * 0.12}px) scale(0.56)` },
      ],
      {
        duration: reduced() ? 0 : 700,
        easing: EASE_IN_OUT,
        fill: "forwards",
      }
    );
  }

  function handle(signal: MarkSignal, values: Values) {
    const el = mark.current;
    switch (signal.type) {
      case "input":
        if (signal.field === "email" && state.current !== "success") {
          draw(signal.value);
          setLine(caption(variant, signal.value, state.current));
        }
        return;
      case "submit":
        state.current = "pending";
        el?.removeAttribute("data-error");
        setLine(caption(variant, values.email, "pending"));
        ripple();
        return;
      case "error":
        state.current = "error";
        el?.setAttribute("data-error", "");
        setLine(caption(variant, values.email, "error"));
        shake();
        return;
      case "clear":
        state.current = "idle";
        el?.removeAttribute("data-error");
        setLine(caption(variant, values.email, "idle"));
        return;
      case "success":
        state.current = "success";
        succeed(values);
        return;
      case "reset":
        state.current = "idle";
        shrink.current?.cancel();
        shrink.current = null;
        panel.current?.removeAttribute("data-state");
        draw(values.email);
        setLine(caption(variant, values.email, "idle"));
        return;
      default:
        return;
    }
  }

  useMarkListener(handle);

  return (
    <aside
      aria-hidden
      className="auth-panel dark"
      data-auth-panel
      data-surface="panel"
      ref={panel}
    >
      <div className="auth-panel__meta">
        <span>{copy.label}</span>
        <span className="tabular-nums" ref={code} />
      </div>
      <div className="auth-art">
        <div className="auth-mosaic" ref={mark}>
          {Array.from({ length: GRID * GRID }, (_, i) => (
            <div className="auth-mark-cell" key={i}>
              <div data-colour="seed" data-key="seed" data-shape />
            </div>
          ))}
        </div>
        <div className="auth-panel__chip">
          <span className="auth-panel__chip-name" ref={chipName} />
          <span className="auth-panel__chip-sub" ref={chipSub} />
        </div>
      </div>
      <div className="auth-panel__caption">
        <p className="auth-panel__line">
          <span className="inline-block" ref={line}>
            {copy.empty}
          </span>
        </p>
        <p className="auth-panel__note">{copy.note}</p>
      </div>
    </aside>
  );
}
