import { formatDate } from "@/lib/format";

/**
 * Plain words for a session row: the browser and system from its user
 * agent, and where it signed in from. Pure, so tests cover it without a
 * request.
 */

export type Device = {
  browser: string;
  os: string;
  kind: "desktop" | "phone" | "tablet" | "other";
};

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
  [/^curl\//, "curl"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPod/, "iOS"],
  [/iPad/, "iPadOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function describeDevice(userAgent: string | null | undefined): Device {
  const ua = userAgent ?? "";
  const browser =
    BROWSERS.find(([re]) => re.test(ua))?.[1] ?? "Unknown browser";
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? "";
  let kind: Device["kind"] = "other";
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) {
    kind = "tablet";
  } else if (/iPhone|iPod|Mobile/.test(ua)) {
    kind = "phone";
  } else if (os) {
    kind = "desktop";
  }
  return { browser, os, kind };
}

/** "Chrome on macOS", or just the browser when the system is unknown. */
export function deviceLabel(device: Device) {
  return device.os ? `${device.browser} on ${device.os}` : device.browser;
}

const LOOPBACK = /^(127\.|::1$|0{0,4}(:0{0,4}){7}$|::ffff:127\.)/;
const PRIVATE =
  /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|f[cd][0-9a-f]{2}:|fe80:|::ffff:(10\.|192\.168\.))/i;

/**
 * Where a session came from. The app has no IP-to-city lookup, so this is
 * the address itself, or a plain word for this machine and private
 * networks. Null when nothing was recorded.
 */
export function describeLocation(ip: string | null | undefined) {
  if (!ip) {
    return null;
  }
  if (LOOPBACK.test(ip)) {
    return "This computer";
  }
  if (PRIVATE.test(ip)) {
    return "Local network";
  }
  return ip;
}

/** "Active now", "5 min ago", "3 hours ago", "2 days ago", or a date. */
export function activeLabel(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 2) {
    return "Active now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }
  return formatDate(iso);
}
