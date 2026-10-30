"use client";

import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { type ComponentProps, type ReactNode, useState } from "react";

import { Confirm } from "@/components/confirm";
import { toast } from "@/lib/toast";

type CheckoutLike = {
  reference: string;
  accessCode: string;
  authorizationUrl: string;
};

export type BillingActionName =
  | "checkout"
  | "change-plan"
  | "cancel"
  | "resume"
  | "manage-card";

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
    } catch (error) {
      // The inline script didn't load (blocked or offline): the hosted page
      // completes the same transaction.
      // biome-ignore lint/suspicious/noConsole: the only trace that the popup fell back.
      console.warn(
        "Paystack inline checkout unavailable; using the hosted page",
        error
      );
    }
  }
  window.location.assign(checkout.authorizationUrl);
}

const SUCCESS: Partial<Record<BillingActionName, string>> = {
  "change-plan": "Plan updated",
  cancel: "Subscription will end at the end of this period",
  resume: "Plan resumed",
};

/** A toast action that reverses the one just taken (cancel → resume). */
export type BillingUndo = { label: string; action: BillingActionName };

export function useBillingAction({
  orgId,
  action,
  planPriceId,
  publicKey,
  successMessage,
  undo,
}: {
  orgId: string;
  action: BillingActionName;
  planPriceId?: string;
  publicKey?: string;
  successMessage?: string;
  undo?: BillingUndo;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
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
      toast.success(successMessage ?? SUCCESS[action] ?? "Done", {
        action: undo
          ? {
              label: undo.label,
              onClick: async () => {
                try {
                  await call(orgId, undo.action);
                  toast.success(SUCCESS[undo.action] ?? "Done");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Couldn't undo");
                }
                router.refresh();
              },
            }
          : undefined,
      });
      router.refresh();
      setPending(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setPending(false);
    }
  }

  return { run, pending };
}

export type BillingConfirm = {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/**
 * One billing button. Optional `confirm` puts an AlertDialog in front of it.
 * Errors and results surface as toasts.
 */
export function BillingAction({
  orgId,
  action,
  planPriceId,
  publicKey,
  confirm,
  successMessage,
  undo,
  children,
  disabled,
  ...buttonProps
}: {
  orgId: string;
  action: BillingActionName;
  planPriceId?: string;
  publicKey?: string;
  confirm?: BillingConfirm;
  successMessage?: string;
  undo?: BillingUndo;
  children: ReactNode;
} & Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const { run, pending } = useBillingAction({
    orgId,
    action,
    planPriceId,
    publicKey,
    successMessage,
    undo,
  });
  const [open, setOpen] = useState(false);

  const button = (
    <Button
      {...buttonProps}
      disabled={disabled}
      onClick={() => (confirm ? setOpen(true) : run())}
      pending={pending}
    >
      {children}
    </Button>
  );

  if (!confirm) {
    return button;
  }

  return (
    <>
      {button}
      <Confirm
        cancelLabel={confirm.cancelLabel ?? "Keep it"}
        confirmLabel={confirm.confirmLabel}
        description={confirm.description}
        destructive={confirm.destructive}
        onConfirm={run}
        onOpenChange={setOpen}
        open={open}
        title={confirm.title}
      />
    </>
  );
}
