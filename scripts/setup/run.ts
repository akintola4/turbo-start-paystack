import { spawn } from "node:child_process";

export class RunError extends Error {
  constructor(
    message: string,
    readonly stdout: string,
    readonly stderr: string,
    /** The time limit ran out and the process group was killed. */
    readonly killed: boolean
  ) {
    super(message);
  }
}

/**
 * Runs a command in its own process group and resolves with its output.
 * When `timeoutMs` runs out, or setup itself is interrupted, the whole group
 * gets SIGKILL, so a `pnpm` or `bash` wrapper can't leave drizzle-kit,
 * initdb or pg_ctl running behind it.
 */
export function runGroup(
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs: number }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let killed = false;
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    const killGroup = () => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          // The group is already gone.
        }
      }
    };
    const onSignal = (signal: NodeJS.Signals) => {
      killGroup();
      process.kill(process.pid, signal);
    };
    const timer = setTimeout(() => {
      killed = true;
      killGroup();
    }, options.timeoutMs);
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
    const cleanUp = () => {
      clearTimeout(timer);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    };
    child.once("error", (error) => {
      cleanUp();
      reject(new RunError(error.message, stdout, stderr, false));
    });
    child.once("close", (code, signal) => {
      cleanUp();
      if (killed) {
        // Anything the group left behind is killed with it.
        killGroup();
        reject(new RunError(`${command} timed out`, stdout, stderr, true));
      } else if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(
          new RunError(
            `${command} exited with ${code ?? signal}`,
            stdout,
            stderr,
            false
          )
        );
      }
    });
  });
}
