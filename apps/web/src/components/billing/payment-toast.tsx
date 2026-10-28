"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import type { SubscriptionStatus } from "@/lib/view-models";

const TOAST_ID = "payment";
const LIVE: SubscriptionStatus[] = ["active", "trialing"];

/**
 * Turns the `?payment=` result from /billing/callback into one toast. While
 * Paystack hasn't confirmed yet it shows a loading toast and re-renders the
 * page every 2s (up to 20s); the toast resolves when the plan goes live.
 */
export function PaymentToast({
  payment,
  status,
}: {
  payment: string | null;
  status: SubscriptionStatus | null;
}) {
  const router = useRouter();
  const tries = useRef(0);
  const settled = useRef(false);

  useEffect(() => {
    if (!payment || settled.current) {
      return;
    }
    const clearParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState(null, "", url);
    };
    if (
      payment === "succeeded" ||
      (status &&
        LIVE.includes(status) &&
        payment === "created" &&
        tries.current > 0)
    ) {
      settled.current = true;
      toast.success("Payment confirmed", {
        id: TOAST_ID,
        description: "Paystack confirmed it and your plan is live.",
      });
      clearParam();
      return;
    }
    if (payment === "created") {
      toast.loading("Confirming with Paystack…", {
        id: TOAST_ID,
        description: "This usually takes a few seconds.",
      });
      if (tries.current >= 10) {
        settled.current = true;
        toast.info("Still waiting for Paystack", {
          id: TOAST_ID,
          description:
            "We'll update the plan as soon as the payment is confirmed. You can leave this page.",
        });
        clearParam();
        return;
      }
      const timer = window.setTimeout(() => {
        tries.current += 1;
        router.refresh();
      }, 2000);
      return () => window.clearTimeout(timer);
    }
    settled.current = true;
    toast.error("Payment didn't go through", {
      id: TOAST_ID,
      description: "Nothing was charged. Try again or use another card.",
    });
    clearParam();
  }, [payment, status, router]);

  return null;
}
