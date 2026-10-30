/** The parts of a Better Auth client error the forms read. */
export type AuthErrorLike = {
  status?: number;
  code?: string;
  message?: string;
};

export type AuthFormError = {
  message: string;
  /** The field to mark invalid, when one is to blame. */
  field?: "email" | "password" | "confirm";
};

export const RATE_LIMITED =
  "Too many attempts from here. Wait a minute, then try again.";

/**
 * Turns an auth error into one sentence for the form, and the field it
 * belongs to. Rate limits read as a pause, not a failure.
 */
export function authFormError(
  error: AuthErrorLike,
  action: "sign-in" | "sign-up" | "request-reset" | "reset"
): AuthFormError {
  if (error.status === 429) {
    return { message: RATE_LIMITED };
  }
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return {
        message: "That email and password don't match an account.",
        field: "password",
      };
    case "EMAIL_NOT_VERIFIED":
      return {
        message: "Verify your email first. Check your inbox for the link.",
        field: "email",
      };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return {
        message: "There's already an account for this email. Sign in instead.",
        field: "email",
      };
    case "INVALID_EMAIL":
      return { message: "Enter a valid email address.", field: "email" };
    case "PASSWORD_TOO_SHORT":
      return {
        message: "Use at least 10 characters.",
        field: "password",
      };
    case "PASSWORD_TOO_LONG":
      return { message: "Use at most 128 characters.", field: "password" };
    case "INVALID_TOKEN":
      return {
        message: "This reset link has expired or was already used.",
      };
    default:
      return {
        message: {
          "sign-in": "Couldn't sign you in. Try again.",
          "sign-up": "Couldn't create the account. Try again.",
          "request-reset": "Couldn't send the reset link. Try again.",
          reset: "Couldn't change the password. Try again.",
        }[action],
      };
  }
}
