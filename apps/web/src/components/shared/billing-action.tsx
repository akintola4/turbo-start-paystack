"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ComponentProps, type ReactNode, useState } from "react";
import { toast } from "sonner";

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
    } catch {
      // Fall through to the hosted page.
    }
  }
  window.location.assign(checkout.authorizationUrl);
}

const SUCCESS: Partial<Record<BillingActionName, string>> = {
  "change-plan": "Plan updated",
  cancel: "Subscription will end at the end of this period",
  resume: "Subscription resumed",
};

export function useBillingAction({
  orgId,
  action,
  planPriceId,
  publicKey,
  successMessage,
}: {
  orgId: string;
  action: BillingActionName;
  planPriceId?: string;
  publicKey?: string;
  successMessage?: string;
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
      toast.success(successMessage ?? SUCCESS[action] ?? "Done");
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
  children,
  pendingLabel,
  disabled,
  ...buttonProps
}: {
  orgId: string;
  action: BillingActionName;
  planPriceId?: string;
  publicKey?: string;
  confirm?: BillingConfirm;
  successMessage?: string;
  children: ReactNode;
  pendingLabel?: ReactNode;
} & Omit<ComponentProps<typeof Button>, "onClick" | "children">) {
  const { run, pending } = useBillingAction({
    orgId,
    action,
    planPriceId,
    publicKey,
    successMessage,
  });
  const [open, setOpen] = useState(false);

  const button = (
    <Button
      {...buttonProps}
      aria-busy={pending || undefined}
      disabled={pending || disabled}
      onClick={() => (confirm ? setOpen(true) : run())}
    >
      {pending ? (
        <>
          <Loader2Icon aria-hidden className="animate-spin" />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );

  if (!confirm) {
    return button;
  }

  return (
    <>
      {button}
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {confirm.cancelLabel ?? "Keep it"}
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                confirm.destructive &&
                  buttonVariants({ variant: "destructive" })
              )}
              onClick={() => {
                setOpen(false);
                run();
              }}
            >
              {confirm.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
