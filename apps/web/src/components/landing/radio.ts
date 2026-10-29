import type { KeyboardEvent } from "react";

/**
 * Arrow-key handling for a radio group with one tab stop: arrows move and
 * select, Home/End jump. Returns the next index, or null for other keys.
 */
export function nextRadioIndex(
  event: KeyboardEvent,
  index: number,
  count: number
): number | null {
  const moves: Record<string, number> = {
    ArrowRight: index + 1,
    ArrowDown: index + 1,
    ArrowLeft: index - 1,
    ArrowUp: index - 1,
    Home: 0,
    End: count - 1,
  };
  const raw = moves[event.key];
  if (raw === undefined) {
    return null;
  }
  event.preventDefault();
  return (raw + count) % count;
}
