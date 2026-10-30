import { describe, expect, it } from "vitest";

import {
  describeDevice,
  describeLocation,
  deviceLabel,
} from "../src/lib/sessions";

const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WINDOWS_EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36";

describe("describeDevice", () => {
  it("names the browser and system", () => {
    expect(deviceLabel(describeDevice(MAC_CHROME))).toBe("Chrome on macOS");
    expect(deviceLabel(describeDevice(WINDOWS_EDGE))).toBe("Edge on Windows");
    expect(deviceLabel(describeDevice(IPHONE_SAFARI))).toBe("Safari on iOS");
  });

  it("tells phones, tablets and desktops apart", () => {
    expect(describeDevice(IPHONE_SAFARI).kind).toBe("phone");
    expect(describeDevice(ANDROID_TABLET).kind).toBe("tablet");
    expect(describeDevice(MAC_CHROME).kind).toBe("desktop");
  });

  it("falls back for scripts and missing agents", () => {
    expect(deviceLabel(describeDevice("curl/8.7.1"))).toBe("curl");
    expect(deviceLabel(describeDevice(null))).toBe("Unknown browser");
    expect(describeDevice(null).kind).toBe("other");
  });
});

describe("describeLocation", () => {
  it("says this computer for loopback, local network for private ranges", () => {
    expect(describeLocation("127.0.0.1")).toBe("This computer");
    expect(describeLocation("::1")).toBe("This computer");
    expect(describeLocation("0000:0000:0000:0000:0000:0000:0000:0000")).toBe(
      "This computer"
    );
    expect(describeLocation("192.168.1.20")).toBe("Local network");
    expect(describeLocation("172.20.0.4")).toBe("Local network");
  });

  it("shows a public address as it is, and nothing when none was kept", () => {
    expect(describeLocation("102.89.4.10")).toBe("102.89.4.10");
    expect(describeLocation(null)).toBeNull();
  });
});
