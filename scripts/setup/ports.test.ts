import { createServer, type Server } from "node:net";
import { afterAll, describe, expect, it } from "vitest";

import { choosePorts, isPortFree, PortClash, pickPort, portOf } from "./ports";

const servers: Server[] = [];
afterAll(() => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))));

function listen(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer();
    servers.push(server);
    server.listen(0, () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

describe("ports", () => {
  it("returns the preferred port when it is free", async () => {
    expect(await pickPort(3000, { isFree: async () => true })).toBe(3000);
  });

  it("skips taken and avoided ports", async () => {
    const taken = new Set([3000, 3002]);
    const port = await pickPort(3000, {
      avoid: [3001],
      isFree: async (p) => !taken.has(p),
    });
    expect(port).toBe(3003);
  });

  it("gives up after the given number of attempts", async () => {
    await expect(
      pickPort(4010, { attempts: 3, isFree: async () => false })
    ).rejects.toThrow(/4010 and 4012/);
  });

  it("sees a real listening socket as taken", async () => {
    const port = await listen();
    expect(await isPortFree(port)).toBe(false);
    expect(await pickPort(port, { attempts: 20 })).not.toBe(port);
  });

  it("reads ports from URLs", () => {
    expect(portOf("http://localhost:3005")).toBe(3005);
    expect(portOf("https://app.test")).toBe(443);
    expect(portOf("nope")).toBeNull();
    expect(portOf(undefined)).toBeNull();
  });
});

describe("choosePorts", () => {
  const allFree = async () => true;

  it("keeps the app off a fixed mock port", async () => {
    await expect(
      choosePorts({
        keptApp: null,
        keptMock: 3000,
        mockMode: true,
        isFree: allFree,
      })
    ).resolves.toEqual({ app: 3002, mock: 3000 });
  });

  it("keeps the mock off the app port", async () => {
    await expect(
      choosePorts({
        keptApp: 4010,
        keptMock: null,
        mockMode: true,
        isFree: allFree,
      })
    ).resolves.toEqual({ app: 4010, mock: 4011 });
  });

  it("refuses two fixed ports that clash", async () => {
    await expect(
      choosePorts({
        keptApp: 4010,
        keptMock: 4010,
        mockMode: true,
        isFree: allFree,
      })
    ).rejects.toThrow(PortClash);
  });

  it("picks no mock port off the mock", async () => {
    await expect(
      choosePorts({
        keptApp: null,
        keptMock: 3000,
        mockMode: false,
        isFree: allFree,
      })
    ).resolves.toEqual({ app: 3000, mock: null });
  });
});
