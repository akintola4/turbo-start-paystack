"use client";

import { Button } from "@workspace/ui/components/button";
import { UserPlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { InviteDialog } from "@/components/shared/member-actions";
import type { Role } from "@/directions/types";

/** Invite button that also opens itself when the URL has ?invite=1 (from ⌘K). */
export function InviteLauncher({
  organizationId,
  roles,
  seatsNote,
}: {
  organizationId: string;
  roles: Role[];
  seatsNote?: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wantsOpen = params.get("invite") === "1";

  useEffect(() => {
    if (wantsOpen) {
      ref.current?.click();
      router.replace(pathname, { scroll: false });
    }
  }, [wantsOpen, pathname, router]);

  return (
    <InviteDialog
      organizationId={organizationId}
      roles={roles}
      seatsNote={seatsNote}
      trigger={
        <Button className="h-8" ref={ref} size="sm">
          <UserPlusIcon />
          Invite member
        </Button>
      }
    />
  );
}
