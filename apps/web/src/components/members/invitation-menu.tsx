"use client";

import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { CopyIcon, MoreHorizontalIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

import { Confirm } from "@/components/confirm";
import { useRowPresenceActions } from "@/components/motion";
import { authClient } from "@/lib/auth-client";
import { toastFailure } from "@/lib/toast-error";

/** One "…" menu per invitation so the column lines up with the members table. */
export function InvitationMenu({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const router = useRouter();
  const presence = useRowPresenceActions();
  const [confirm, setConfirm] = useState(false);

  async function revoke() {
    presence?.markLeaving(invitationId);
    const result = await authClient.organization.cancelInvitation({
      invitationId,
    });
    if (result.error) {
      presence?.unmark(invitationId);
      toastFailure(result.error, "Couldn't revoke the invitation");
      return;
    }
    toast.success(`Invitation for ${email} revoked`);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for invitation to ${email}`}
              size="icon-sm"
              variant="ghost"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${window.location.origin}/accept-invite/${invitationId}`
              );
              toast.success("Invite link copied");
            }}
          >
            <CopyIcon />
            Copy invite link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setConfirm(true)}
            variant="destructive"
          >
            <XIcon />
            Revoke invitation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Confirm
        confirmLabel="Revoke invitation"
        description={`The link stops working, and ${email} can't join unless you invite them again.`}
        destructive
        onConfirm={revoke}
        onOpenChange={setConfirm}
        open={confirm}
        title="Revoke this invitation?"
      />
    </>
  );
}
