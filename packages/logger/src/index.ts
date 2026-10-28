const SECRET_KEY_PATTERN =
  /token|authorization_code|authorizationcode|secret|password|signature|cookie/i;

const REDACTED = "[redacted]";

/**
 * Deep-copies `value`, replacing anything stored under a secret-looking key.
 * Paystack payloads carry `email_token` and `authorization_code`; neither may
 * reach a log line.
 */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redact(inner);
    }
    return out;
  }
  return value;
}

type Level = "info" | "warn" | "error";

export class Logger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  private write(level: Level, message: string, data?: Record<string, unknown>) {
    const line = `[${this.context}] ${level.toUpperCase()}: ${message}`;
    const args = data === undefined ? [] : [redact(data)];
    if (level === "error") {
      console.error(line, ...args);
    } else if (level === "warn") {
      console.warn(line, ...args);
    } else {
      console.log(line, ...args);
    }
  }

  info(message: string, data?: Record<string, unknown>) {
    this.write("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>) {
    this.write("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>) {
    this.write("error", message, data);
  }
}
