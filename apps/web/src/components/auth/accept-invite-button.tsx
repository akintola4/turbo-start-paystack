"use client";

import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@/lib/toast";

import { authClient } from "@/lib/auth-client";

export function AcceptInviteButton({
  invitationId,
  orgName,
}: {
  invitationId: string;
  orgName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      className="w-full"
      onClick={async () => {
        setPending(true);
        const result = await authClient.organization.acceptInvitation({
          invitationId,
        });
        if (result.error) {
          setPending(false);
          toast.error("Couldn't join", {
            description:
              result.error.message ?? "This invitation can't be used.",
          });
          return;
        }
        toast.success(`You joined ${orgName}`);
        router.push("/app");
        router.refresh();
      }}
      pending={pending}
    >
      Join {orgName}
    </Button>
  );
}

/** Signed in as someone else: sign out, then sign in as the invited address. */
export function SwitchAccountButton({ signInHref }: { signInHref: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      className="w-full"
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.push(signInHref);
      }}
      pending={pending}
    >
      Sign out and switch account
    </Button>
  );
}
