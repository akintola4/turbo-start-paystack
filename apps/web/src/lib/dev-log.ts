export type LogTone = "ok" | "ignored" | "rejected" | "error";

/**
 * The toast for a simulated run: the worst outcome in its log wins, so a
 * rejected signature or an ignored duplicate never reads as a success.
 */
export function toastKindFor(
  tones: LogTone[]
): "success" | "warning" | "error" {
  if (tones.includes("error")) {
    return "error";
  }
  if (tones.includes("rejected") || tones.includes("ignored")) {
    return "warning";
  }
  return "success";
}
