"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  Loader2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";

import { FormAlert } from "@/components/auth/auth-form";
import { Confirm } from "@/components/confirm";
import { MarkAvatar } from "@/components/mark-avatar";
import { PageHeader } from "@/components/primitives";
import { SettingsDialog } from "@/components/settings/dialog";
import { postJson } from "@/components/settings/post";
import { SettingsRow, SettingsSection } from "@/components/settings/section";
import { TypeToConfirm } from "@/components/settings/type-to-confirm";
import { authClient } from "@/lib/auth-client";
import { roleLabel } from "@/lib/format";
import { slugInput, slugProblem } from "@/lib/org-settings";
import { toast } from "@/lib/toast";
import type { OrgSettingsData } from "@/lib/view-models";

const url = (orgId: string, action: string) =>
  `/api/orgs/${orgId}/settings/${action}`;

type SlugStatus =
  | { state: "same" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken"; message: string }
  | { state: "invalid"; message: string };

/** Asks Better Auth whether a slug is free, 350ms after typing stops. */
function useSlugStatus(slug: string, current: string): SlugStatus {
  const [status, setStatus] = useState<SlugStatus>({ state: "same" });
  useEffect(() => {
    if (slug === current) {
      setStatus({ state: "same" });
      return;
    }
    const problem = slugProblem(slug);
    if (problem) {
      setStatus({ state: "invalid", message: problem });
      return;
    }
    setStatus({ state: "checking" });
    let live = true;
    const timer = setTimeout(async () => {
      const result = await authClient.organization.checkSlug({ slug });
      if (!live) {
        return;
      }
      setStatus(
        result.error
          ? {
              state: "taken",
              message:
                result.error.status === 400 &&
                /reserved/i.test(result.error.message ?? "")
                  ? (result.error.message ?? "That address is reserved.")
                  : `/app/${slug} is taken. Pick another.`,
            }
          : { state: "available" }
      );
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [slug, current]);
  return status;
}

/** One line under the address field. Always one line tall, so the form
 *  below never moves as the status changes. */
function SlugHint({ status, id }: { status: SlugStatus; id: string }) {
  const base = "flex min-h-5 items-center gap-1.5 text-sm";
  switch (status.state) {
    case "checking":
      return (
        <p
          aria-live="polite"
          className={cn(base, "text-muted-foreground")}
          id={id}
        >
          <Loader2Icon
            aria-hidden
            className="size-3.5 animate-spin motion-reduce:animate-none"
          />
          Checking…
        </p>
      );
    case "available":
      return (
        <p aria-live="polite" className={cn(base, "text-success")} id={id}>
          <CircleCheckIcon aria-hidden className="size-3.5" />
          Available
        </p>
      );
    case "taken":
    case "invalid":
      return (
        <p aria-live="polite" className={cn(base, "text-destructive")} id={id}>
          <CircleAlertIcon aria-hidden className="size-3.5 shrink-0" />
          {status.message}
        </p>
      );
    default:
      return (
        <p
          aria-live="polite"
          className={cn(base, "text-muted-foreground")}
          id={id}
        >
          Old links stop working if you change it.
        </p>
      );
  }
}

function GeneralSection({ data }: { data: OrgSettingsData }) {
  const router = useRouter();
  const [name, setName] = useState(data.org.name);
  const [slug, setSlug] = useState(data.org.slug);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = useSlugStatus(slug, data.org.slug);
  const hintId = useId();
  const changed = name.trim() !== data.org.name || slug !== data.org.slug;
  const slugBad = status.state === "taken" || status.state === "invalid";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || slugBad) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await postJson<{ slug: string }>(
      url(data.org.id, "general"),
      { name: name.trim(), slug }
    );
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }
    if (result.data.slug !== data.org.slug) {
      toast.success("Address changed", {
        description: `The organization now lives at /app/${result.data.slug}.`,
      });
      router.replace(`/app/${result.data.slug}/settings`);
      return;
    }
    setPending(false);
    toast.success("Name saved");
    router.refresh();
  }

  const logo = (
    <div className="flex items-center gap-4">
      <MarkAvatar seed={data.org.id} size="lg" />
      <p className="max-w-64 text-muted-foreground text-sm">
        The organization's mark, drawn like the one on the sign-in page. It
        stays the same through renames.
      </p>
    </div>
  );

  if (!data.can.update) {
    return (
      <SettingsSection
        description="Only owners and admins can change these."
        id="general"
        title="General"
      >
        {logo}
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <dt className="text-muted-foreground text-sm">Name</dt>
            <dd className="font-medium">{data.org.name}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground text-sm">Address</dt>
            <dd className="font-mono text-sm">/app/{data.org.slug}</dd>
          </div>
        </dl>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      description="How the organization appears to everyone in it, and its address in the app."
      id="general"
      title="General"
    >
      {logo}
      <form className="grid gap-5" noValidate onSubmit={onSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="org-name">Name</Label>
            <Input
              autoComplete="organization"
              id="org-name"
              maxLength={64}
              onChange={(e) => setName(e.target.value)}
              required
              value={name}
            />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="org-slug">Address</Label>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center font-mono text-muted-foreground text-sm"
              >
                /app/
              </span>
              <Input
                aria-describedby={hintId}
                aria-invalid={slugBad || undefined}
                autoCapitalize="none"
                autoComplete="off"
                className="pl-[3.25rem] font-mono"
                data-1p-ignore
                id="org-slug"
                maxLength={48}
                onChange={(e) => setSlug(slugInput(e.target.value))}
                spellCheck={false}
                value={slug}
              />
            </div>
            <SlugHint id={hintId} status={status} />
          </div>
        </div>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div>
          <Button
            disabled={!changed || slugBad || status.state === "checking"}
            pending={pending}
            type="submit"
          >
            Save changes
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function BillingSection({ data }: { data: OrgSettingsData }) {
  if (!(data.hrefs.billing && data.hrefs.billingDetails)) {
    return null;
  }
  return (
    <SettingsSection
      description="The plan, the card and who invoices are made out to live on the Billing page."
      id="billing"
      title="Billing"
    >
      <SettingsRow
        description="Legal name, address, tax ID and billing email on new invoices."
        title="Invoice details"
      >
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={data.hrefs.billingDetails}
        >
          Edit in Billing
          <ArrowRightIcon aria-hidden />
        </Link>
      </SettingsRow>
      <SettingsRow
        description={
          data.currency.fromSubscription
            ? "Set when the plan started. Paystack bills a subscription in one currency for its whole life."
            : "Set for the whole app by BILLING_CURRENCY. A plan keeps the currency it starts in."
        }
        title={
          <>
            Currency{" "}
            <span className="font-mono text-muted-foreground">
              {data.currency.code}
            </span>
          </>
        }
      />
    </SettingsSection>
  );
}

function MembersSection({ data }: { data: OrgSettingsData }) {
  return (
    <SettingsSection
      description="Who's in the organization and what each role can do."
      id="members"
      title="Members & roles"
    >
      <SettingsRow
        description={`${data.memberCount} ${data.memberCount === 1 ? "person" : "people"}. Your role: ${roleLabel(data.role)}.`}
        title="Members"
      >
        <Link
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={data.hrefs.members}
        >
          Manage members
          <ArrowRightIcon aria-hidden />
        </Link>
      </SettingsRow>
    </SettingsSection>
  );
}

function TransferOwnership({ data }: { data: OrgSettingsData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState(
    data.transferTargets[0]?.memberId ?? ""
  );
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = data.transferTargets.find((t) => t.memberId === memberId);
  const matches = typed.trim() === data.org.name.trim();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(matches && target)) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await postJson(url(data.org.id, "transfer"), {
      memberId,
      confirm: typed,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpen(false);
    toast.success(`${target.name} owns ${data.org.name} now`, {
      description: "You're an admin. They can make you an owner again.",
    });
    router.refresh();
  }

  return (
    <SettingsRow
      description={
        data.transferTargets.length
          ? "Make someone else the owner. You become an admin."
          : "Invite someone first: there's nobody to hand it to."
      }
      title="Transfer ownership"
    >
      <Button
        disabled={!data.transferTargets.length}
        onClick={() => {
          setTyped("");
          setError(null);
          setOpen(true);
        }}
        size="sm"
        variant="outline"
      >
        Transfer…
      </Button>
      <SettingsDialog
        description="They get every owner permission, including billing and deleting the organization. You stay on as an admin."
        onOpenChange={setOpen}
        open={open}
        title="Transfer ownership"
      >
        <form className="grid gap-5" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="transfer-to">New owner</Label>
            <Select
              items={data.transferTargets.map((t) => ({
                value: t.memberId,
                label: t.name,
              }))}
              onValueChange={(v) => v && setMemberId(v)}
              value={memberId}
            >
              <SelectTrigger className="w-full" id="transfer-to">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.transferTargets.map((t) => (
                  <SelectItem key={t.memberId} value={t.memberId}>
                    {t.name}
                    <span className="text-muted-foreground">
                      {roleLabel(t.role)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <TypeToConfirm
            expected={data.org.name}
            id="transfer-confirm"
            onChange={setTyped}
            value={typed}
          />
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Button disabled={!matches} pending={pending} type="submit">
            Transfer ownership
          </Button>
        </form>
      </SettingsDialog>
    </SettingsRow>
  );
}

function DeleteOrganization({ data }: { data: OrgSettingsData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim() === data.org.name.trim();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await postJson(url(data.org.id, "delete"), {
      confirm: typed,
    });
    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }
    toast.success(`${data.org.name} was deleted`);
    router.push("/app");
    router.refresh();
  }

  if (data.deleteBlocked) {
    return (
      <SettingsRow
        data-delete-blocked
        description={data.deleteBlocked.message}
        title="Delete organization"
      >
        {data.hrefs.billing ? (
          <Link
            className={buttonVariants({ size: "sm", variant: "outline" })}
            href={data.hrefs.billing}
          >
            Go to Billing
            <ArrowRightIcon aria-hidden />
          </Link>
        ) : null}
      </SettingsRow>
    );
  }

  return (
    <SettingsRow
      description="Removes everyone's access and deletes its billing history and invoices. Download any invoices you need first."
      title="Delete organization"
    >
      <Button
        onClick={() => {
          setTyped("");
          setError(null);
          setOpen(true);
        }}
        size="sm"
        variant="destructive"
      >
        Delete…
      </Button>
      <SettingsDialog
        description={`This deletes ${data.org.name} for all ${data.memberCount} ${data.memberCount === 1 ? "member" : "members"}, with its invoices and billing history. It can't be undone.`}
        onOpenChange={setOpen}
        open={open}
        title="Delete organization"
      >
        <form className="grid gap-5" onSubmit={onSubmit}>
          <TypeToConfirm
            expected={data.org.name}
            id="delete-confirm"
            onChange={setTyped}
            value={typed}
          />
          {error ? <FormAlert>{error}</FormAlert> : null}
          <Button
            disabled={!matches}
            pending={pending}
            type="submit"
            variant="destructive"
          >
            Delete {data.org.name}
          </Button>
        </form>
      </SettingsDialog>
    </SettingsRow>
  );
}

function LeaveOrganization({ data }: { data: OrgSettingsData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function leave() {
    setPending(true);
    const result = await postJson(url(data.org.id, "leave"));
    if (!result.ok) {
      setPending(false);
      toast.error("Couldn't leave", { description: result.message });
      return;
    }
    toast.success(`You left ${data.org.name}`);
    router.push("/app");
    router.refresh();
  }

  return (
    <SettingsRow
      description="You lose access straight away. Someone has to invite you to come back."
      title="Leave organization"
    >
      <Button
        onClick={() => setOpen(true)}
        pending={pending}
        size="sm"
        variant="destructive"
      >
        Leave…
      </Button>
      <Confirm
        confirmLabel={`Leave ${data.org.name}`}
        description="You lose access to its pages straight away. Someone has to invite you again to come back."
        destructive
        onConfirm={leave}
        onOpenChange={setOpen}
        open={open}
        title={`Leave ${data.org.name}?`}
      />
    </SettingsRow>
  );
}

function DangerZone({ data }: { data: OrgSettingsData }) {
  return (
    <SettingsSection
      description={
        data.can.own
          ? "Changes here are hard or impossible to undo."
          : "Leaving takes effect straight away."
      }
      id="danger"
      title="Danger zone"
    >
      {data.can.own ? (
        <>
          <TransferOwnership data={data} />
          {data.soleOwner ? null : <LeaveOrganization data={data} />}
          <DeleteOrganization data={data} />
        </>
      ) : (
        <LeaveOrganization data={data} />
      )}
    </SettingsSection>
  );
}

export function OrgSettings({ data }: { data: OrgSettingsData }) {
  return (
    <div className="grid animate-content gap-8">
      <PageHeader
        description={`Name, address and ownership of ${data.org.name}.`}
        title="Settings"
      />
      <div className="grid max-w-3xl gap-6">
        <GeneralSection data={data} />
        <BillingSection data={data} />
        <MembersSection data={data} />
        <DangerZone data={data} />
      </div>
    </div>
  );
}
