import { describe, expect, it } from "vitest";

import { stopCommand } from "./postgres";

describe("stopCommand", () => {
  it("reads the stop line dev-db.sh prints", () => {
    expect(
      stopCommand(
        "DATABASE_URL=postgres://postgres@127.0.0.1:54329/tsp\nStop it with: pg_ctl -D /repo/.pgdata stop\n"
      )
    ).toBe("pg_ctl -D /repo/.pgdata stop");
    expect(stopCommand("Stop it with: docker stop tsp-postgres\n")).toBe(
      "docker stop tsp-postgres"
    );
  });

  it("is null when there is no stop line", () => {
    expect(stopCommand("DATABASE_URL=postgres://x\n")).toBeNull();
  });
});
