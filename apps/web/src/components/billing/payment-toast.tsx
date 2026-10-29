"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { paymentOutcome } from "@/lib/payment-copy";
import { toast } from "@/lib/toast";
import type { SubscriptionSummary } from "@/lib/view-models";

const TOAST_ID = "payment";
const LIVE = new Set(["active", "trialing"]);

/**
 * Turns the `?payment=` result from /billing/callback into one toast. While
 * Paystack hasn't confirmed yet it shows a loading toast and re-renders the
 * page every 2s (up to 20s); the toast resolves when the plan goes live.
 */
export function PaymentToast({
  payment,
  sub,
}: {
  payment: string | null;
  sub: SubscriptionSummary | null;
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
    const live =
      sub && LIVE.has(sub.status) && payment === "created" && tries.current > 0;
    const outcome = paymentOutcome(live ? "succeeded" : payment, sub, {
      gaveUp: tries.current >= 10,
    });
    if (outcome.kind === "loading") {
      toast.loading(outcome.title, {
        id: TOAST_ID,
        description: outcome.description,
      });
      const timer = window.setTimeout(() => {
        tries.current += 1;
        router.refresh();
      }, 2000);
      return () => window.clearTimeout(timer);
    }
    settled.current = true;
    toast[outcome.kind](outcome.title, {
      id: TOAST_ID,
      description: outcome.description,
    });
    clearParam();
  }, [payment, sub, router]);

  return null;
}
