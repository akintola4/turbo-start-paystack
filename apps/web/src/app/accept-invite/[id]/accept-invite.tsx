"use client";

import { Button } from "@workspace/ui/components/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

export function AcceptInvite({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="grid gap-3">
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await authClient.organization.acceptInvitation({
            invitationId,
          });
          setPending(false);
          if (result.error) {
            setError(result.error.message ?? "This invitation can't be used");
            return;
          }
          router.push("/app");
          router.refresh();
        }}
      >
        Accept invitation
      </Button>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
