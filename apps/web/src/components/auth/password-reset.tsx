"use client";

import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { FormAlert, inlineLinkClass } from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth-client";
import {
  type AuthFormError,
  authFormError,
  RATE_LIMITED,
} from "@/lib/auth-errors";

/**
 * Asks for the address and always answers the same way, so the page never
 * reveals whether an account exists.
 */
export function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (result.error) {
      const formError = authFormError(result.error, "request-reset");
      setError(formError);
      if (formError.message === RATE_LIMITED) {
        toast.warning("Slow down a moment", { description: RATE_LIMITED });
      }
      return;
    }
    setSentTo(email);
    toast.success("Check your inbox", {
      description: "If there's an account, the reset link is on its way.",
    });
  }

  if (sentTo) {
    return (
      <div className="grid gap-6" role="status">
        <div className="flex items-start gap-3 rounded-tile bg-surface-2 p-4">
          <MailCheckIcon
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-success"
          />
          <p className="text-sm">
            If an account exists for{" "}
            <span className="break-all font-semibold">{sentTo}</span>, we've
            sent a link to reset the password. It works for one hour.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm">
          <button
            className={inlineLinkClass}
            onClick={() => setSentTo(null)}
            type="button"
          >
            Use a different email
          </button>
          <Link className={inlineLinkClass} href="/sign-in">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          aria-describedby={error ? "reset-error" : undefined}
          aria-invalid={error?.field === "email" || undefined}
          autoCapitalize="none"
          autoComplete="email"
          id="email"
          inputMode="email"
          name="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          spellCheck={false}
          type="email"
          value={email}
        />
      </div>
      {error ? (
        <div id="reset-error">
          <FormAlert>{error.message}</FormAlert>
        </div>
      ) : null}
      <Button className="w-full" pending={pending} type="submit">
        Send reset link
      </Button>
      <p className="text-center text-muted-foreground text-sm">
        Remembered it?{" "}
        <Link className={inlineLinkClass} href="/sign-in">
          Sign in
        </Link>
      </p>
    </form>
  );
}

/** New password + confirmation, from the emailed link's token. */
export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(
    token ? null : authFormError({ code: "INVALID_TOKEN" }, "reset")
  );

  if (!token) {
    return (
      <div className="grid gap-5">
        <FormAlert>{error?.message}</FormAlert>
        <Link
          className={buttonVariants({ className: "w-full" })}
          href="/forgot-password"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirm"))) {
      setError({ message: "The two passwords don't match.", field: "confirm" });
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.resetPassword({
      newPassword,
      token: token ?? "",
    });
    if (result.error) {
      setPending(false);
      setError(authFormError(result.error, "reset"));
      return;
    }
    toast.success("Password changed", {
      description: "Sign in with your new password.",
    });
    router.push("/sign-in");
  }

  const invalid = (field: AuthFormError["field"]) =>
    error?.field === field || undefined;

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          aria-describedby="password-hint"
          aria-invalid={invalid("password")}
          autoComplete="new-password"
          id="password"
          minLength={10}
          name="password"
          required
          type="password"
        />
        <p className="text-muted-foreground text-sm" id="password-hint">
          At least 10 characters.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Type it again</Label>
        <Input
          aria-describedby={error ? "reset-error" : undefined}
          aria-invalid={invalid("confirm")}
          autoComplete="new-password"
          id="confirm"
          minLength={10}
          name="confirm"
          onChange={() => error?.field === "confirm" && setError(null)}
          required
          type="password"
        />
      </div>
      {error ? (
        <div className="grid gap-2" id="reset-error">
          <FormAlert>{error.message}</FormAlert>
          {error.field ? null : (
            <Link className={inlineLinkClass} href="/forgot-password">
              Send a new link
            </Link>
          )}
        </div>
      ) : null}
      <Button className="w-full" pending={pending} type="submit">
        Change password
      </Button>
    </form>
  );
}
