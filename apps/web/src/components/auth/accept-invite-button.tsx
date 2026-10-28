"use client";

import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/tailwind-config/utils";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function AcceptInviteButton({
  invitationId,
  className,
  label = "Accept invitation",
  orgName,
}: {
  orgName?: string;
  invitationId: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <div className="grid gap-3">
      <Button
        className={cn("w-full", className)}
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await authClient.organization.acceptInvitation({
            invitationId,
          });
          setPending(false);
          if (result.error) {
            const message =
              result.error.message ?? "This invitation can't be used";
            toast.error("Couldn't join", { description: message });
            return;
          }
          toast.success(
            orgName ? `You joined ${orgName}` : "Invitation accepted"
          );
          router.push("/app");
          router.refresh();
        }}
      >
        {pending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
        {label}
      </Button>
    </div>
  );
}
