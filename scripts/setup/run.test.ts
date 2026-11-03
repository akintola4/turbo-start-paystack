import { describe, expect, it } from "vitest";

import { RunError, runGroup } from "./run";

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("runGroup", () => {
  it("resolves with the output", async () => {
    await expect(
      runGroup("bash", ["-c", "echo out; echo err >&2"], { timeoutMs: 5000 })
    ).resolves.toEqual({ stdout: "out\n", stderr: "err\n" });
  });

  it("rejects with stderr on a non-zero exit", async () => {
    const error = await runGroup("bash", ["-c", "echo nope >&2; exit 3"], {
      timeoutMs: 5000,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RunError);
    expect(error).toMatchObject({ killed: false, stderr: "nope\n" });
  });

  it("kills the grandchildren too when the time runs out", async () => {
    // bash starts a sleep (a grandchild of ours) and prints its pid. Killing
    // only bash would leave the sleep running.
    const pidFile = `${process.env.TMPDIR ?? "/tmp"}/run-group-${process.pid}`;
    const error = await runGroup(
      "bash",
      ["-c", `sleep 30 & echo $! > ${pidFile}; wait`],
      { timeoutMs: 500 }
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ killed: true });
    const { readFileSync, rmSync } = await import("node:fs");
    const sleepPid = Number(readFileSync(pidFile, "utf8"));
    rmSync(pidFile, { force: true });
    await new Promise((r) => setTimeout(r, 100));
    expect(alive(sleepPid)).toBe(false);
  });
});
