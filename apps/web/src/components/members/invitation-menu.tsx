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
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

/** One "…" menu per invitation so the column lines up with the members table. */
export function InvitationMenu({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Actions for invitation to ${email}`}
            className="size-8 rounded-full"
            size="icon"
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
          onClick={async () => {
            const result = await authClient.organization.cancelInvitation({
              invitationId,
            });
            if (result.error) {
              toast.error(
                result.error.message ?? "Could not revoke the invitation"
              );
              return;
            }
            toast.success(`Invitation for ${email} revoked`);
            router.refresh();
          }}
          variant="destructive"
        >
          <XIcon />
          Revoke invitation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
