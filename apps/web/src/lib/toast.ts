import type { ReactNode } from "react";
import { type ExternalToast, toast as sonner } from "sonner";

const WORDS_PER_SECOND = 4;
const MIN_MS = 4000;

function words(value: ReactNode | (() => ReactNode) | undefined) {
  return typeof value === "string"
    ? value.split(/\s+/).filter(Boolean).length
    : 0;
}

/** Reading time: max(4s, words ÷ 4 per second) for title and description. */
export function toastDuration(
  title: ReactNode,
  description?: ExternalToast["description"]
) {
  const total = words(title) + words(description as ReactNode);
  return Math.max(MIN_MS, Math.ceil((total / WORDS_PER_SECOND) * 1000));
}

type Show = (message: ReactNode, data?: ExternalToast) => string | number;

const timed =
  (show: Show): Show =>
  (message, data) =>
    show(message, {
      duration: toastDuration(message, data?.description),
      ...data,
    });

/**
 * Sonner with durations that scale with the words (design §5). Sonner
 * already pauses on hover and while the tab is hidden.
 */
export const toast = Object.assign(timed(sonner), {
  success: timed(sonner.success),
  error: timed(sonner.error),
  warning: timed(sonner.warning),
  info: timed(sonner.info),
  loading: sonner.loading,
  dismiss: sonner.dismiss,
});
