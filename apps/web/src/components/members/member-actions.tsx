"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { cn } from "@workspace/tailwind-config/utils";
import {
  CopyIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  UserMinusIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactElement,
  type ReactNode,
  useState,
} from "react";
import { toast } from "sonner";

import type { MemberRow, Role } from "@/lib/view-models";
import { Confirm } from "@/components/confirm";
import { useRowPresenceActions } from "@/components/motion";
import { authClient } from "@/lib/auth-client";
import { useNarrow } from "@/lib/use-narrow";
import { ROLE_META, roleLabel } from "@/lib/format";

/* ------------------------------------------------------------------ invite */

export function InviteFields({
  roles,
  idPrefix = "invite",
  layout = "stack",
}: {
  roles: Role[];
  idPrefix?: string;
  layout?: "stack" | "row";
}) {
  const [role, setRole] = useState<Role>(
    roles.includes("member") ? "member" : (roles[0] ?? "member")
  );
  return (
    <div
      className={cn(
        "grid gap-4",
        layout === "row" && "sm:grid-cols-[1fr_11rem] sm:items-end"
      )}
    >
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-email`}>Email address</Label>
        <Input
          autoComplete="off"
          id={`${idPrefix}-email`}
          name="email"
          placeholder="name@company.com"
          required
          type="email"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-role`}>Role</Label>
        <input name="role" type="hidden" value={role} />
        <Select
          items={roles.map((r) => ({ value: r, label: roleLabel(r) }))}
          onValueChange={(v) => v && setRole(v as Role)}
          value={role}
        >
          <SelectTrigger className="w-full" id={`${idPrefix}-role`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r} value={r}>
                <span className="grid gap-0.5 text-left">
                  <span>{roleLabel(r)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function useInvite(organizationId: string, onDone?: () => void) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const email = String(form.get("email"));
    setPending(true);
    const result = await authClient.organization.inviteMember({
      organizationId,
      email,
      role: String(form.get("role")) as Role,
    });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "Could not send the invitation");
      return;
    }
    formEl.reset();
    toast.success(`Invitation sent to ${email}`);
    router.refresh();
    onDone?.();
  }
  return { onSubmit, pending };
}

/** Inline invite form (no dialog). */
export function InviteForm({
  organizationId,
  roles,
  layout = "row",
  submitLabel = "Send invite",
  className,
}: {
  organizationId: string;
  roles: Role[];
  layout?: "stack" | "row";
  submitLabel?: string;
  className?: string;
}) {
  const { onSubmit, pending } = useInvite(organizationId);
  return (
    <form
      className={cn(
        "grid gap-4",
        layout === "row" && "sm:grid-cols-[1fr_auto] sm:items-end",
        className
      )}
      onSubmit={onSubmit}
    >
      <InviteFields idPrefix="inline-invite" layout={layout} roles={roles} />
      <Button disabled={pending} type="submit">
        {pending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}

export function InviteDialog({
  organizationId,
  roles,
  trigger,
  seatsNote,
}: {
  organizationId: string;
  roles: Role[];
  trigger: ReactElement;
  seatsNote?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const narrow = useNarrow();
  const { onSubmit, pending } = useInvite(organizationId, () => setOpen(false));
  const body = (
    <>
      <InviteFields idPrefix="dialog-invite" roles={roles} />
      {seatsNote ? (
        <div className="text-muted-foreground text-sm">{seatsNote}</div>
      ) : null}
    </>
  );
  const submit = (
    <Button disabled={pending} type="submit">
      {pending ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
      Send invite
    </Button>
  );
  const title = "Invite a teammate";
  const description =
    "They get an email with a link that works for 7 days, only for this address.";
  if (narrow) {
    return (
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger render={trigger} />
        <SheetContent showCloseButton={false} side="bottom">
          <form className="grid gap-5 px-5 pt-6" onSubmit={onSubmit}>
            <SheetHeader className="gap-2 p-0">
              <SheetTitle className="font-semibold text-xl">{title}</SheetTitle>
              <SheetDescription className="text-[15px]">
                {description}
              </SheetDescription>
            </SheetHeader>
            {body}
            <div className="grid gap-2">
              {submit}
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <form className="grid gap-6" onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
          <DialogFooter>
            <Button
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            {submit}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------- role */

export function RoleSelect({
  organizationId,
  member,
  roles,
  className,
  size = "sm",
}: {
  organizationId: string;
  member: Pick<MemberRow, "id" | "name" | "role">;
  roles: Role[];
  className?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(member.role);
  const [pending, setPending] = useState(false);
  const options = [...new Set([member.role, ...roles])];
  return (
    <Select
      disabled={pending}
      items={options.map((r) => ({ value: r, label: roleLabel(r) }))}
      onValueChange={async (next) => {
        if (!next) {
          return;
        }
        const previous = value;
        setValue(next);
        setPending(true);
        const result = await authClient.organization.updateMemberRole({
          organizationId,
          memberId: member.id,
          role: next as Role,
        });
        setPending(false);
        if (result.error) {
          setValue(previous);
          toast.error(result.error.message ?? "Could not change the role");
          return;
        }
        toast.success(
          `${member.name} is now ${roleLabel(next).toLowerCase() === "admin" ? "an admin" : `a ${roleLabel(next).toLowerCase()}`}`
        );
        router.refresh();
      }}
      value={value}
    >
      <SelectTrigger
        aria-label={`Role for ${member.name}`}
        className={className}
        size={size}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((r) => (
          <SelectItem key={r} value={r}>
            {roleLabel(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ remove */

function useRemoveMember(
  organizationId: string,
  member: Pick<MemberRow, "id" | "name">
) {
  const router = useRouter();
  const presence = useRowPresenceActions();
  const [pending, setPending] = useState(false);
  async function remove() {
    setPending(true);
    presence?.markLeaving(member.id);
    const result = await authClient.organization.removeMember({
      organizationId,
      memberIdOrEmail: member.id,
    });
    setPending(false);
    if (result.error) {
      presence?.unmark(member.id);
      toast.error(result.error.message ?? "Could not remove the member");
      return;
    }
    toast.success(`${member.name} was removed`);
    router.refresh();
  }
  return { remove, pending };
}

function RemoveDialog({
  open,
  onOpenChange,
  member,
  orgName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Pick<MemberRow, "name" | "email">;
  orgName: string;
  onConfirm: () => void;
}) {
  return (
    <Confirm
      confirmLabel="Remove member"
      description={`${member.email} loses access to ${orgName} straight away. You can invite them again later.`}
      destructive
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      title={`Remove ${member.name}?`}
    />
  );
}

export function RemoveMemberButton({
  organizationId,
  orgName,
  member,
  className,
  label = "Remove",
}: {
  organizationId: string;
  orgName: string;
  member: Pick<MemberRow, "id" | "name" | "email">;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const { remove, pending } = useRemoveMember(organizationId, member);
  return (
    <>
      <Button
        aria-label={`Remove ${member.name}`}
        className={className}
        disabled={pending}
        onClick={() => setOpen(true)}
        size="sm"
        variant="ghost"
      >
        {label}
      </Button>
      <RemoveDialog
        member={member}
        onConfirm={remove}
        onOpenChange={setOpen}
        open={open}
        orgName={orgName}
      />
    </>
  );
}

/** Row "…" menu: change role (radio) and remove. */
export function MemberRowMenu({
  organizationId,
  orgName,
  member,
  roles,
  triggerClassName,
}: {
  organizationId: string;
  orgName: string;
  member: MemberRow;
  roles: Role[];
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const { remove } = useRemoveMember(organizationId, member);
  if (!(member.canUpdate || member.canRemove)) {
    return null;
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={`Actions for ${member.name}`}
              className={cn("size-8", triggerClassName)}
              size="icon"
              variant="ghost"
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="truncate px-2 py-1.5 text-muted-foreground text-xs">
            {member.email}
          </div>
          {member.canUpdate ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup
                  onValueChange={async (next) => {
                    const result =
                      await authClient.organization.updateMemberRole({
                        organizationId,
                        memberId: member.id,
                        role: next as Role,
                      });
                    if (result.error) {
                      toast.error(
                        result.error.message ?? "Could not change the role"
                      );
                      return;
                    }
                    toast.success(`Role changed to ${roleLabel(next)}`);
                    router.refresh();
                  }}
                  value={member.role}
                >
                  {[...new Set([member.role, ...roles])].map((r) => (
                    <DropdownMenuRadioItem
                      className="items-start"
                      key={r}
                      value={r}
                    >
                      <span className="grid gap-0.5">
                        <span>{roleLabel(r)}</span>
                        <span className="text-muted-foreground text-xs">
                          {ROLE_META[r]?.description}
                        </span>
                      </span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
          {member.canRemove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setConfirm(true)}
                variant="destructive"
              >
                <UserMinusIcon />
                Remove from organization
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <RemoveDialog
        member={member}
        onConfirm={remove}
        onOpenChange={setConfirm}
        open={confirm}
        orgName={orgName}
      />
    </>
  );
}

/* ------------------------------------------------------------- invitations */

export function CancelInvitationButton({
  invitationId,
  email,
  className,
  iconOnly = false,
}: {
  invitationId: string;
  email: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      aria-label={`Revoke invitation for ${email}`}
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await authClient.organization.cancelInvitation({
          invitationId,
        });
        setPending(false);
        if (result.error) {
          toast.error(
            result.error.message ?? "Could not revoke the invitation"
          );
          return;
        }
        toast.success(`Invitation for ${email} revoked`);
        router.refresh();
      }}
      size={iconOnly ? "icon" : "sm"}
      variant="ghost"
    >
      {iconOnly ? <XIcon /> : "Revoke"}
    </Button>
  );
}

export function CopyInviteLinkButton({
  invitationId,
  className,
  iconOnly = false,
}: {
  invitationId: string;
  className?: string;
  iconOnly?: boolean;
}) {
  return (
    <Button
      aria-label="Copy invite link"
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(
          `${window.location.origin}/accept-invite/${invitationId}`
        );
        toast.success("Invite link copied");
      }}
      size={iconOnly ? "icon" : "sm"}
      variant="ghost"
    >
      <CopyIcon />
      {iconOnly ? null : "Copy link"}
    </Button>
  );
}
