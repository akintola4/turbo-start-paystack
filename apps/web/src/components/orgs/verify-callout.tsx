"use client";

import { Button } from "@workspace/ui/components/button";
import { MailIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

/** Unverified email: one callout with the address and a resend action. */
export function VerifyCallout({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  return (
    <div
      className="flex flex-col gap-4 rounded-card bg-info-bg p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
      role="status"
    >
      <div className="flex gap-3">
        <MailIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-info" />
        <div className="grid gap-1">
          <p className="font-semibold">Verify your email</p>
          <p className="text-muted-foreground text-sm">
            We sent a link to {email}. Accepting invitations waits for it.
          </p>
        </div>
      </div>
      <Button
        pending={pending}
        onClick={async () => {
          setPending(true);
          const result = await authClient.sendVerificationEmail({
            email,
            callbackURL: "/app",
          });
          setPending(false);
          if (result.error) {
            toast.error("Couldn't resend the email", {
              description: result.error.message,
            });
            return;
          }
          toast.success("Verification email sent again", {
            description: email,
          });
        }}
        variant="outline"
      >
        Resend
      </Button>
    </div>
  );
}
