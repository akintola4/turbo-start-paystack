"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { NativeSelect } from "@workspace/ui/components/native-select";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

type Role = "owner" | "admin" | "billing" | "member" | "viewer";

export function InviteForm({
  organizationId,
  assignableRoles,
}: {
  organizationId: string;
  assignableRoles: Role[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setPending(true);
    const result = await authClient.organization.inviteMember({
      organizationId,
      email: String(form.get("email")),
      role: String(form.get("role")) as Role,
    });
    setPending(false);
    if (result.error) {
      setMessage(result.error.message ?? "Could not send the invitation");
      return;
    }
    formEl.reset();
    setMessage("Invitation sent.");
    router.refresh();
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={onSubmit}
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input id="invite-email" name="email" required type="email" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-role">Role</Label>
        <NativeSelect defaultValue="member" id="invite-role" name="role">
          {assignableRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button disabled={pending} type="submit">
        Invite
      </Button>
      {message ? (
        <p className="text-sm" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}

export function MemberRoleSelect({
  organizationId,
  memberId,
  role,
  assignableRoles,
}: {
  organizationId: string;
  memberId: string;
  role: string;
  assignableRoles: Role[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        aria-label="Role"
        className="w-32"
        defaultValue={role}
        onChange={async (event) => {
          const result = await authClient.organization.updateMemberRole({
            organizationId,
            memberId,
            role: event.target.value as Role,
          });
          setError(result.error?.message ?? null);
          router.refresh();
        }}
      >
        {[...new Set([role, ...assignableRoles])].map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </NativeSelect>
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
    </div>
  );
}

export function RemoveMemberButton({
  organizationId,
  memberId,
}: {
  organizationId: string;
  memberId: string;
}) {
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await authClient.organization.removeMember({
          organizationId,
          memberIdOrEmail: memberId,
        });
        router.refresh();
      }}
      size="sm"
      variant="ghost"
    >
      Remove
    </Button>
  );
}

export function CancelInvitationButton({
  invitationId,
}: {
  invitationId: string;
}) {
  const router = useRouter();
  return (
    <Button
      onClick={async () => {
        await authClient.organization.cancelInvitation({ invitationId });
        router.refresh();
      }}
      size="sm"
      variant="ghost"
    >
      Cancel
    </Button>
  );
}
