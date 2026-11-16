import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  databaseRefusal,
  OptionError,
  parseSetupOptions,
  seedsDemo,
} from "./options";

const TTY = { stdin: true, stdout: true };
const NO_TTY = { stdin: false, stdout: false };

describe("setup options", () => {
  it("prompts only with a terminal and no --yes", () => {
    expect(parseSetupOptions([], {}, TTY)).toMatchObject({
      yes: false,
      interactive: true,
    });
    expect(parseSetupOptions([], {}, NO_TTY).interactive).toBe(false);
    expect(
      parseSetupOptions([], {}, { stdin: false, stdout: true })
    ).toMatchObject({ interactive: false });
  });

  it.each([
    [["--yes"], {}],
    [["-y"], {}],
    [[], { CI: "1" }],
    [[], { CI: "true" }],
    [[], { SETUP_YES: "1" }],
  ])("%j %j means never prompt", (argv, env) => {
    expect(parseSetupOptions(argv, env, TTY)).toMatchObject({
      yes: true,
      interactive: false,
    });
  });

  it("treats CI=0 and CI=false as unset", () => {
    expect(parseSetupOptions([], { CI: "0" }, TTY).yes).toBe(false);
    expect(parseSetupOptions([], { CI: "false" }, TTY).yes).toBe(false);
  });

  it("reads the database, name and ports from flags or the environment", () => {
    const fromEnv = parseSetupOptions(
      [],
      {
        DATABASE_URL: "postgres://ada@127.0.0.1:5432/tsp",
        SETUP_DB: "tsp_other",
        SETUP_PORT: "3600",
        SETUP_MOCK_PORT: "4600",
      },
      NO_TTY
    );
    expect(fromEnv).toMatchObject({
      databaseUrl: "postgres://ada@127.0.0.1:5432/tsp",
      db: "tsp_other",
      appPort: 3600,
      mockPort: 4600,
    });
    const fromFlags = parseSetupOptions(
      ["--db=tsp_flag", "--port=3700", "--mock-port=4700", "--reset"],
      { SETUP_PORT: "3600" },
      NO_TTY
    );
    expect(fromFlags).toMatchObject({
      db: "tsp_flag",
      appPort: 3700,
      mockPort: 4700,
      reset: true,
    });
  });

  it("rejects values it can't use, instead of guessing", () => {
    expect(() =>
      parseSetupOptions([], { DATABASE_URL: "mysql://x/y" }, NO_TTY)
    ).toThrow(OptionError);
    expect(() => parseSetupOptions([], { SETUP_PORT: "80" }, NO_TTY)).toThrow(
      /1024 to 65535/
    );
    expect(() => parseSetupOptions(["--port=abc"], {}, NO_TTY)).toThrow(
      OptionError
    );
    expect(() =>
      parseSetupOptions(
        [],
        { SETUP_PORT: "3600", SETUP_MOCK_PORT: "3600" },
        NO_TTY
      )
    ).toThrow(/different ports/);
  });

  it("needs a database name in DATABASE_URL", () => {
    expect(() =>
      parseSetupOptions(
        [],
        { DATABASE_URL: "postgres://dev@127.0.0.1:5432" },
        NO_TTY
      )
    ).toThrow(/database name/);
    expect(() =>
      parseSetupOptions(
        [],
        { DATABASE_URL: "postgres://dev@127.0.0.1:5432/" },
        NO_TTY
      )
    ).toThrow(/database name/);
  });

  it("rejects a value flag written with a space, and treats an empty one as unset", () => {
    for (const flag of ["--port", "--mock-port", "--db"]) {
      expect(() => parseSetupOptions([flag, "3600"], {}, NO_TTY)).toThrow(
        /equals sign/
      );
    }
    expect(
      parseSetupOptions(
        ["--port=", "--mock-port=", "--db="],
        { SETUP_PORT: "3600", SETUP_MOCK_PORT: "4600", SETUP_DB: "tsp_env" },
        NO_TTY
      )
    ).toMatchObject({ appPort: 3600, mockPort: 4600, db: "tsp_env" });
  });

  it("reads SETUP_ALLOW_REMOTE_DB", () => {
    expect(parseSetupOptions([], {}, NO_TTY).allowRemoteDb).toBe(false);
    expect(
      parseSetupOptions([], { SETUP_ALLOW_REMOTE_DB: "1" }, NO_TTY)
        .allowRemoteDb
    ).toBe(true);
  });
});

describe("which databases setup will touch", () => {
  const remote = "postgres://dev@db.example.test:5432/app";
  const local = "postgres://dev@127.0.0.1:5432/app";
  const base = { fromEnvironment: false, reset: false, allowRemote: false };

  it("takes a local DATABASE_URL from the environment", () => {
    expect(
      databaseRefusal({
        ...base,
        url: local,
        fromEnvironment: true,
        reset: true,
      })
    ).toBeNull();
    expect(
      databaseRefusal({
        ...base,
        url: "postgres://dev@localhost/app",
        fromEnvironment: true,
      })
    ).toBeNull();
  });

  it("refuses a non-local DATABASE_URL inherited from the shell", () => {
    expect(
      databaseRefusal({ ...base, url: remote, fromEnvironment: true })
    ).toMatch(/SETUP_ALLOW_REMOTE_DB/);
  });

  it("uses a non-local URL written in apps/web/.env, but never resets it", () => {
    expect(databaseRefusal({ ...base, url: remote })).toBeNull();
    expect(databaseRefusal({ ...base, url: remote, reset: true })).toMatch(
      /--reset would drop/
    );
  });

  it("allows both with SETUP_ALLOW_REMOTE_DB", () => {
    expect(
      databaseRefusal({
        url: remote,
        fromEnvironment: true,
        reset: true,
        allowRemote: true,
      })
    ).toBeNull();
  });
});

describe("setup without a terminal", () => {
  it("exits 1 with the reason on a bad option, and never waits for input", () => {
    const scripts = fileURLToPath(new URL("..", import.meta.url));
    const run = spawnSync(`${scripts}node_modules/.bin/tsx`, ["setup.ts"], {
      cwd: scripts,
      env: { ...process.env, CI: "1", SETUP_PORT: "not-a-port" },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(1);
    expect(`${run.stdout}${run.stderr}`).toContain(
      "--port / SETUP_PORT must be a port"
    );
  }, 40_000);
});

describe("seedsDemo", () => {
  it("seeds the public demo password only into a local database", () => {
    expect(seedsDemo("postgres://postgres@127.0.0.1:54329/app")).toBe(true);
    expect(seedsDemo("postgres://dev@localhost/app")).toBe(true);
    expect(seedsDemo("postgres://u:p@ep-x.neon.tech/app")).toBe(false);
  });
});
