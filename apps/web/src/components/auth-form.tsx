"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

/** Only same-origin relative paths are allowed as post-auth redirects. */
function safeCallback(value: string | null): string {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/app";
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const callbackURL = safeCallback(params.get("callbackURL"));
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

  const otherHref = `${mode === "sign-in" ? "/sign-up" : "/sign-in"}?callbackURL=${encodeURIComponent(callbackURL)}`;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          {mode === "sign-in" ? "Sign in" : "Create account"}
        </CardTitle>
        <CardDescription>
          {mode === "sign-in"
            ? "Welcome back."
            : "You'll get an email to verify your address."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          {mode === "sign-up" ? (
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input autoComplete="name" id="name" name="name" />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              autoComplete="email"
              id="email"
              name="email"
              required
              type="email"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              autoComplete={
                mode === "sign-in" ? "current-password" : "new-password"
              }
              id="password"
              minLength={10}
              name="password"
              required
              type="password"
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          {sentTo ? (
            <p className="text-muted-foreground text-sm">
              Verification email sent to {sentTo}.
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Sign up"}
          </Button>
          <p className="text-muted-foreground text-sm">
            {mode === "sign-in" ? "No account? " : "Have an account? "}
            <Link className="underline" href={otherHref}>
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
