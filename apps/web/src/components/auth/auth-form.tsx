"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/tailwind-config/utils";
import { Loader2Icon, MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";

import { authClient } from "@/lib/auth-client";

/** Only same-origin relative paths are allowed as post-auth redirects. */
export function safeCallback(value: string | null): string {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/app";
}

export function useAuthLinks(mode: "sign-in" | "sign-up") {
  const params = useSearchParams();
  const callbackURL = safeCallback(params.get("callbackURL"));
  const other = mode === "sign-in" ? "/sign-up" : "/sign-in";
  const suffix =
    callbackURL === "/app"
      ? ""
      : `?callbackURL=${encodeURIComponent(callbackURL)}`;
  return { callbackURL, otherHref: `${other}${suffix}` };
}

/**
 * Email + password form for sign-in and sign-up. Directions supply the frame
 * around it; field styling comes from the theme tokens.
 */
export function AuthForm({
  mode,
  className,
  submitLabel,
  footer,
  submitClassName,
}: {
  mode: "sign-in" | "sign-up";
  className?: string;
  submitLabel?: ReactNode;
  footer?: ReactNode;
  submitClassName?: string;
}) {
  const router = useRouter();
  const { callbackURL } = useAuthLinks(mode);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name") || email.split("@")[0]),
            callbackURL,
          })
        : await authClient.signIn.email({ email, password, callbackURL });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong");
      return;
    }
    if (mode === "sign-up") {
      setSentTo(email);
    }
    router.push(callbackURL);
    router.refresh();
  }

  return (
    <form className={cn("grid gap-5", className)} onSubmit={onSubmit}>
      {mode === "sign-up" ? (
        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            autoComplete="name"
            id="name"
            name="name"
            placeholder="Adaeze Okafor"
          />
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          autoComplete="email"
          id="email"
          inputMode="email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          aria-describedby={mode === "sign-up" ? "password-hint" : undefined}
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          id="password"
          minLength={10}
          name="password"
          required
          type="password"
        />
        {mode === "sign-up" ? (
          <p className="text-muted-foreground text-xs" id="password-hint">
            At least 10 characters.
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {sentTo ? (
        <p
          className="flex items-center gap-2 text-muted-foreground text-sm"
          role="status"
        >
          <MailCheckIcon aria-hidden className="size-4" />
          Verification email sent to {sentTo}.
        </p>
      ) : null}
      <Button
        className={cn("w-full", submitClassName)}
        disabled={pending}
        type="submit"
      >
        {pending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
        {submitLabel ?? (mode === "sign-in" ? "Sign in" : "Create account")}
      </Button>
      {footer}
    </form>
  );
}

export function AuthSwitch({
  mode,
  className,
}: {
  mode: "sign-in" | "sign-up";
  className?: string;
}) {
  const { otherHref } = useAuthLinks(mode);
  return (
    <p className={cn("text-muted-foreground text-sm", className)}>
      {mode === "sign-in" ? "New here? " : "Already have an account? "}
      <Link
        className="font-medium text-foreground underline underline-offset-4"
        href={otherHref}
      >
        {mode === "sign-in" ? "Create an account" : "Sign in"}
      </Link>
    </p>
  );
}
