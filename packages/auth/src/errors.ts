export class AuthError extends Error {
  readonly status: 401 | 403 | 404;

  constructor(status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * True for an AuthError from any copy of this module. Next can bundle the
 * module twice (a page's server-component layer and the auth service it
 * calls), and then `instanceof` is false for an AuthError thrown by the
 * other copy.
 */
export function isAuthError(error: unknown): error is AuthError {
  return (
    error instanceof AuthError ||
    (error instanceof Error &&
      error.name === "AuthError" &&
      typeof (error as { status?: unknown }).status === "number")
  );
}
