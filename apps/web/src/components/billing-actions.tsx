"use client";

import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

type CheckoutLike = {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
};

async function call(orgId: string, action: string, body: unknown = {}) {
  const res = await fetch(`/api/orgs/${orgId}/billing/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data.message ?? data.error ?? `Request failed (${res.status})`
    );
  }
  return data;
}

/**
 * Opens Paystack checkout. With a public key, the inline popup resumes the
 * server-created transaction (only the access code reaches the browser);
 * otherwise it redirects to Paystack's hosted page. Either way the result is
 * confirmed server-side on /billing/callback, never from this callback.
 */
async function openCheckout(checkout: CheckoutLike, publicKey?: string) {
  const callback = `/billing/callback?reference=${encodeURIComponent(checkout.reference)}`;
  if (publicKey && checkout.accessCode) {
    try {
      const { default: PaystackPop } = await import("@paystack/inline-js");
      new PaystackPop().resumeTransaction(checkout.accessCode, {
        onSuccess: () => window.location.assign(callback),
      });
      return;
    } catch {
      // Fall through to the hosted page.
    }
  }
  window.location.assign(checkout.authorizationUrl);
}

export function BillingButton({
  orgId,
  action,
  planPriceId,
  publicKey,
  confirm,
  children,
  variant = "default",
  disabled,
}: {
  orgId: string;
  action: "checkout" | "change-plan" | "cancel" | "resume" | "manage-card";
  planPriceId?: string;
  publicKey?: string;
  confirm?: string;
  children: ReactNode;
  variant?: "default" | "outline" | "destructive" | "secondary";
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !window.confirm(confirm)) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const data = await call(
        orgId,
        action,
        planPriceId ? { planPriceId } : {}
      );
      if (action === "checkout" || data.kind === "checkout_required") {
        await openCheckout(data, publicKey);
        return;
      }
      if (action === "manage-card") {
        window.location.assign(data.url);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-1">
      <Button
        disabled={pending || disabled}
        onClick={run}
        size="sm"
        variant={variant}
      >
        {pending ? "Working…" : children}
      </Button>
      {error ? (
        <p className="max-w-56 text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
