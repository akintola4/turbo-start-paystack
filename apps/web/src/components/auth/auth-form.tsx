"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { CircleAlertIcon, MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "@/lib/toast";

import { authClient } from "@/lib/auth-client";
import { type AuthFormError, authFormError } from "@/lib/auth-errors";

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
  const keep = new URLSearchParams();
  if (callbackURL !== "/app") {
    keep.set("callbackURL", callbackURL);
  }
  const query = keep.size ? `?${keep}` : "";
  return { callbackURL, otherHref: `${other}${query}` };
}

/** Inline form error: icon + sentence, announced, above the submit button. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p
      className="flex items-start gap-2 rounded-control bg-destructive-bg px-3.5 py-3 text-destructive text-sm"
      role="alert"
    >
      <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** A text link with a 44px-tall hit area that doesn't move the text. */
export const inlineLinkClass =
  "relative font-medium text-link underline-offset-4 before:absolute before:-inset-x-1 before:-inset-y-3 hover:underline";

const RESEND_COOLDOWN_S = 30;

/** Seconds left before Resend is allowed again; counts down once a second. */
function useCooldown() {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) {
      return;
    }
    const id = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return { left, start: () => setLeft(RESEND_COOLDOWN_S) };
}

/** Webmail shortcuts for the domains most people sign up with. */
function inboxLinks(email: string) {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return [
      { label: "Open Gmail", href: "https://mail.google.com/mail/u/0/#inbox" },
    ];
  }
  if (/^(outlook|hotmail|live)\./.test(domain)) {
    return [
      { label: "Open Outlook", href: "https://outlook.live.com/mail/0/" },
    ];
  }
  if (domain === "yahoo.com") {
    return [{ label: "Open Yahoo Mail", href: "https://mail.yahoo.com/" }];
  }
  return [];
}

/**
 * After sign-up: the form gives way to "check your inbox". The account
 * exists and is signed in, so carrying on without verifying is allowed;
 * inviting people waits for the verified email.
 */
function CheckEmail({
  email,
  callbackURL,
  onChangeEmail,
}: {
  email: string;
  callbackURL: string;
  onChangeEmail: () => void;
}) {
  const cooldown = useCooldown();
  const [pending, setPending] = useState(false);

  async function resend() {
    setPending(true);
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL,
    });
    setPending(false);
    if (result.error) {
      toast.error("Couldn't resend the email", {
        description: authFormError(result.error, "sign-up").message,
      });
      return;
    }
    cooldown.start();
    toast.success("Sent again", {
      description: `A new link is on its way to ${email}.`,
    });
  }

  return (
    <div className="grid gap-6" role="status">
      <div className="flex items-start gap-3 rounded-tile bg-surface-2 p-4">
        <MailCheckIcon
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-success"
        />
        <p className="text-sm">
          We sent a verification link to{" "}
          <span className="break-all font-semibold">{email}</span>. Open it on
          this device to finish.
        </p>
      </div>
      <div className="grid gap-3">
        {inboxLinks(email).map((link) => (
          <a
            className={buttonVariants({
              variant: "default",
              className: "w-full",
            })}
            href={link.href}
            key={link.href}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ))}
        <Button
          className="w-full tabular-nums"
          disabled={cooldown.left > 0}
          onClick={resend}
          pending={pending}
          type="button"
          variant="outline"
        >
          {cooldown.left > 0
            ? `Resend in ${cooldown.left}s`
            : "Resend the email"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm">
        <button
          className={inlineLinkClass}
          onClick={onChangeEmail}
          type="button"
        >
          Use a different email
        </button>
        <Link className={inlineLinkClass} href={callbackURL}>
          Continue to your account
        </Link>
      </div>
    </div>
  );
}

/** Email + password form for sign-in and sign-up. */
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const { callbackURL } = useAuthLinks(mode);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(null);
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
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
    if (result.error) {
      setPending(false);
      setError(authFormError(result.error, mode));
      return;
    }
    if (mode === "sign-up") {
      setPending(false);
      setSentTo(email);
      return;
    }
    // Stays pending through the navigation, so the button doesn't flicker.
    router.push(callbackURL);
    router.refresh();
  }

  if (sentTo) {
    return (
      <CheckEmail
        callbackURL={callbackURL}
        email={sentTo}
        onChangeEmail={() => setSentTo(null)}
      />
    );
  }

  const forgotHref = email
    ? `/forgot-password?email=${encodeURIComponent(email)}`
    : "/forgot-password";

  return (
    <form className="grid gap-5" onSubmit={onSubmit}>
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
          aria-describedby={error?.field === "email" ? "auth-error" : undefined}
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
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          {mode === "sign-in" ? (
            <Link
              className={cn(inlineLinkClass, "text-[13px]")}
              href={forgotHref}
            >
              Forgot password?
            </Link>
          ) : null}
        </div>
        <Input
          aria-describedby={
            [
              mode === "sign-up" ? "password-hint" : null,
              error?.field === "password" ? "auth-error" : null,
            ]
              .filter(Boolean)
              .join(" ") || undefined
          }
          aria-invalid={error?.field === "password" || undefined}
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          id="password"
          minLength={10}
          name="password"
          onChange={() => error?.field === "password" && setError(null)}
          required
          type="password"
        />
        {mode === "sign-up" ? (
          <p className="text-muted-foreground text-sm" id="password-hint">
            At least 10 characters.
          </p>
        ) : null}
      </div>
      {error ? (
        <div id="auth-error">
          <FormAlert>{error.message}</FormAlert>
        </div>
      ) : null}
      <Button className="w-full" pending={pending} type="submit">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

export function AuthSwitch({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { otherHref } = useAuthLinks(mode);
  return (
    <p className="text-center text-muted-foreground text-sm">
      {mode === "sign-in" ? "New here? " : "Already have an account? "}
      <Link className={inlineLinkClass} href={otherHref}>
        {mode === "sign-in" ? "Create an account" : "Sign in"}
      </Link>
    </p>
  );
}
