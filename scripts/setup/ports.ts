import { connect, createServer } from "node:net";

/** Something accepts connections on this host and port. */
export function isListening(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 400
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    const done = (open: boolean) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    // No host: binds the IPv6 wildcard (and IPv4 on dual-stack), the way
    // `next dev` does, so a server on either family counts as taken.
    server.listen(port, () => server.close(() => resolve(true)));
  });
}

/** Free for a new dev server: nothing answers on loopback (IPv4 or IPv6)
 *  and the port can be bound. */
export async function isPortFree(port: number): Promise<boolean> {
  const [v4, v6] = await Promise.all([
    isListening(port, "127.0.0.1"),
    isListening(port, "::1"),
  ]);
  return !(v4 || v6) && (await canBind(port));
}

/**
 * The preferred port if it is free, otherwise the next free one above it.
 * `avoid` holds ports already handed out in this run, or reserved by
 * convention (3001 is the email preview).
 */
export async function pickPort(
  preferred: number,
  options: {
    avoid?: Iterable<number>;
    isFree?: (port: number) => Promise<boolean>;
    attempts?: number;
  } = {}
): Promise<number> {
  const avoid = new Set(options.avoid ?? []);
  const isFree = options.isFree ?? isPortFree;
  const attempts = options.attempts ?? 50;
  for (let port = preferred; port < preferred + attempts; port++) {
    if (!avoid.has(port) && (await isFree(port))) {
      return port;
    }
  }
  throw new Error(
    `No free port between ${preferred} and ${preferred + attempts - 1}`
  );
}

/** Port of an http(s) URL, with the scheme's default. */
export function portOf(url: string | undefined): number | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.port) {
      return Number(parsed.port);
    }
    return parsed.protocol === "https:" ? 443 : 80;
  } catch {
    return null;
  }
}
