export class AuthError extends Error {
  readonly status: 401 | 403 | 404;

  constructor(status: 401 | 403 | 404, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
