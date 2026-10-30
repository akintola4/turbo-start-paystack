"use client";

import { cn } from "@workspace/tailwind-config/utils";
import { Button, buttonVariants } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  ArrowRightIcon,
  LaptopIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

import { FormAlert } from "@/components/auth/auth-form";
import { Confirm } from "@/components/confirm";
import { Segmented } from "@/components/landing/segmented";
import {
  THEME_OPTIONS,
  useThemeChoice,
} from "@/components/landing/theme-choice";
import { MarkAvatar } from "@/components/mark-avatar";
import {
  RowPresenceProvider,
  useRowPresence,
  useRowPresenceActions,
} from "@/components/motion";
import { Chip, PageHeader } from "@/components/primitives";
import { SettingsDialog } from "@/components/settings/dialog";
import { postJson } from "@/components/settings/post";
import { SettingsRow, SettingsSection } from "@/components/settings/section";
import { TypeToConfirm } from "@/components/settings/type-to-confirm";
import { authClient } from "@/lib/auth-client";
import { RATE_LIMITED } from "@/lib/auth-errors";
import { toast } from "@/lib/toast";
import type { AccountData, SessionRow } from "@/lib/view-models";

type ClientError = { status?: number; code?: string; message?: string };

/** One sentence for a failed Better Auth call on this page. */
function accountError(error: ClientError, fallback: string) {
  if (error.status === 429) {
    return RATE_LIMITED;
  }
  switch (error.code) {
    case "SESSION_EXPIRED":
    case "SESSION_NOT_FRESH":
      return "For your safety, sign out and back in, then try again.";
    case "INVALID_PASSWORD":
      return "That isn't your current password.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 10 characters.";
    case "PASSWORD_TOO_LONG":
      return "Use at most 128 characters.";
    default:
      return error.message || fallback;
  }
}

function ProfileSection({ data }: { data: AccountData }) {
  const router = useRouter();
  const [name, setName] = useState(data.user.name);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = name.trim() !== data.user.name && name.trim().length > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.updateUser({ name: name.trim() });
    setPending(false);
    if (result.error) {
      setError(
        accountError(result.error, "Your name wasn't saved. Try again.")
      );
      return;
    }
    toast.success("Name saved");
    router.refresh();
  }

  return (
    <SettingsSection
      description="How you appear to the people in your organizations."
      id="profile"
      title="Profile"
    >
      <div className="flex items-center gap-4">
        <MarkAvatar seed={data.user.email} size="lg" />
        <p className="max-w-72 text-muted-foreground text-sm">
          Your mark, drawn from your email like on the sign-in page. It changes
          if your email does.
        </p>
      </div>
      <form className="grid gap-5" onSubmit={onSubmit}>
        <div className="grid max-w-sm gap-2">
          <Label htmlFor="account-name">Name</Label>
          <Input
            autoComplete="name"
            id="account-name"
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            required
            value={name}
          />
        </div>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div>
          <Button disabled={!changed} pending={pending} type="submit">
            Save name
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function EmailSection({ data }: { data: AccountData }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // The banner settles in when a send makes it appear, never on page load.
  const pendingAtLoad = useRef(Boolean(data.pendingEmail));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = email.trim().toLowerCase();
    if (next === data.user.email) {
      setError("That's already your email.");
      return;
    }
    const password = String(new FormData(form).get("password") ?? "");
    setPending(true);
    setError(null);
    // Better Auth's client type has no `password`; the server's change-email
    // hook requires it before anything is sent.
    const body = { newEmail: next, callbackURL: "/app/account", password };
    const result = await authClient.changeEmail(body);
    setPending(false);
    if (result.error) {
      setError(accountError(result.error, "The link wasn't sent. Try again."));
      return;
    }
    setEmail("");
    form.reset();
    toast.success("Approve it from your current inbox", {
      description: `We sent a link to ${data.user.email}. Once you approve, ${next} gets a link to confirm.`,
    });
    router.refresh();
  }

  // Sending again needs the password too, so it refills the form.
  function sendAgain(address: string) {
    setEmail(address);
    setError(null);
    passwordRef.current?.focus();
  }

  return (
    <SettingsSection
      description="The address you sign in with and where account emails go."
      id="email"
      title="Email"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{data.user.email}</span>
        {data.user.emailVerified ? (
          <Chip variant="success">Verified</Chip>
        ) : null}
      </div>
      {data.pendingEmail ? (
        <div
          className="grid gap-3 rounded-card bg-info-bg p-4 text-info sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
          data-pending-email
          data-presence={pendingAtLoad.current ? undefined : "entering"}
          role="status"
        >
          {/* On the first line, not the middle of the block: 16px icon,
              20px line. */}
          <MailIcon
            aria-hidden
            className="mt-0.5 hidden size-4 sm:block sm:self-start"
          />
          <p className="text-pretty text-foreground text-sm">
            Changing to{" "}
            <span className="font-semibold">{data.pendingEmail.email}</span>.
            Approve it from the link we sent to {data.user.email}, then confirm
            it from the new inbox. The links work for{" "}
            {data.pendingEmail.expiresIn}. Until then you sign in with{" "}
            {data.user.email}.
          </p>
          <Button
            onClick={() => sendAgain(data.pendingEmail?.email ?? "")}
            size="sm"
            variant="outline"
          >
            Send again
          </Button>
        </div>
      ) : null}
      <form className="grid gap-5" onSubmit={onSubmit}>
        <div className="grid max-w-sm gap-2">
          <Label htmlFor="account-new-email">New email</Label>
          <Input
            aria-describedby="account-new-email-hint"
            autoCapitalize="none"
            autoComplete="email"
            id="account-new-email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            spellCheck={false}
            type="email"
            value={email}
          />
          <p
            className="text-muted-foreground text-sm"
            id="account-new-email-hint"
          >
            Your current address gets a link to approve the change, then the new
            one gets a link to confirm it. Nothing changes until both are
            opened.
          </p>
        </div>
        <div className="grid max-w-sm gap-2">
          <Label htmlFor="account-email-password">Current password</Label>
          <Input
            autoComplete="current-password"
            id="account-email-password"
            name="password"
            ref={passwordRef}
            required
            type="password"
          />
        </div>
        {error ? <FormAlert>{error}</FormAlert> : null}
        <div>
          <Button disabled={!email.trim()} pending={pending} type="submit">
            Send approval link
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

function PasswordSection({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{
    message: string;
    field?: string;
  } | null>(null);
  const [signOutOthers, setSignOutOthers] = useState(true);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const currentPassword = String(fields.get("current"));
    const newPassword = String(fields.get("new"));
    if (newPassword.length < 10) {
      setError({ message: "Use at least 10 characters.", field: "new" });
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: signOutOthers,
    });
    setPending(false);
    if (result.error) {
      setError({
        message: accountError(
          result.error,
          "Your password wasn't changed. Try again."
        ),
        field:
          result.error.code === "INVALID_PASSWORD"
            ? "current"
            : result.error.code?.startsWith("PASSWORD_")
              ? "new"
              : undefined,
      });
      return;
    }
    form.reset();
    toast.success("Password changed", {
      description: signOutOthers
        ? "Your other devices are signed out."
        : undefined,
    });
    router.refresh();
  }

  const invalid = (field: string) => error?.field === field || undefined;

  return (
    <SettingsSection
      description="At least 10 characters. A long phrase is easier to remember than a short jumble."
      id="password"
      title="Password"
    >
      <form className="grid gap-5" onSubmit={onSubmit}>
        {/* Password managers pair the new password with this account. */}
        <input
          autoComplete="username"
          className="sr-only"
          readOnly
          tabIndex={-1}
          type="email"
          value={email}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="account-current-password">Current password</Label>
            <Input
              aria-invalid={invalid("current")}
              autoComplete="current-password"
              id="account-current-password"
              name="current"
              onChange={() => error?.field === "current" && setError(null)}
              required
              type="password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="account-new-password">New password</Label>
            <Input
              aria-invalid={invalid("new")}
              autoComplete="new-password"
              id="account-new-password"
              minLength={10}
              name="new"
              onChange={() => error?.field === "new" && setError(null)}
              required
              type="password"
            />
          </div>
        </div>
        <Label className="flex w-fit cursor-pointer items-center gap-3 font-normal">
          <Checkbox
            checked={signOutOthers}
            onCheckedChange={(checked) => setSignOutOthers(checked === true)}
          />
          Sign out of my other devices
        </Label>
        {error ? <FormAlert>{error.message}</FormAlert> : null}
        <div>
          <Button pending={pending} type="submit">
            Change password
          </Button>
        </div>
      </form>
    </SettingsSection>
  );
}

const KIND_ICON = {
  desktop: LaptopIcon,
  phone: SmartphoneIcon,
  tablet: TabletIcon,
  other: MonitorSmartphoneIcon,
} as const;

function SessionItem({ session }: { session: SessionRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const rows = useRowPresenceActions();
  const presence = useRowPresence(session.id);
  const Icon = KIND_ICON[session.kind];

  async function revoke() {
    setPending(true);
    rows?.markLeaving(session.id);
    const result = await postJson("/api/account/sessions/revoke", {
      sessionId: session.id,
    });
    if (!result.ok) {
      setPending(false);
      rows?.unmark(session.id);
      toast.error("Couldn't sign it out", { description: result.message });
      return;
    }
    toast.success(`Signed out ${session.device}`);
    router.refresh();
  }

  return (
    <li
      className="flex items-center gap-3 border-border border-t py-4 first:border-t-0 first:pt-0 last:pb-0"
      data-presence={presence}
      data-session={session.id}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-chip bg-surface-2">
        <Icon aria-hidden className="size-[18px] text-muted-foreground" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{session.device}</span>
          {session.current ? <Chip variant="info">This device</Chip> : null}
        </div>
        <p className="truncate text-muted-foreground text-sm">
          {[
            session.location,
            session.current ? "Active now" : session.lastActive,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      {session.current ? null : (
        <Button
          aria-label={`Sign out ${session.device}, ${session.lastActive}`}
          onClick={revoke}
          pending={pending}
          size="sm"
          variant="outline"
        >
          Sign out
        </Button>
      )}
    </li>
  );
}

/** This device and the four most recently active; the rest on request. */
const SHOWN_SESSIONS = 5;

/**
 * Rows revealed by "Show more" settle in, and signed-out rows fade the
 * moment the request starts (the refresh lands underneath).
 */
function SessionsSection({ data }: { data: AccountData }) {
  return (
    <RowPresenceProvider
      ids={data.sessions.slice(0, SHOWN_SESSIONS).map((s) => s.id)}
    >
      <SessionsBody data={data} />
    </RowPresenceProvider>
  );
}

function SessionsBody({ data }: { data: AccountData }) {
  const router = useRouter();
  const rows = useRowPresenceActions();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [all, setAll] = useState(false);
  const others = data.sessions.filter((s) => !s.current).length;
  const shown = all ? data.sessions : data.sessions.slice(0, SHOWN_SESSIONS);
  const hidden = data.sessions.length - shown.length;

  async function signOutOthers() {
    setPending(true);
    const leaving = data.sessions.filter((s) => !s.current).map((s) => s.id);
    for (const id of leaving) {
      rows?.markLeaving(id);
    }
    const result = await authClient.revokeOtherSessions();
    setPending(false);
    if (result.error) {
      for (const id of leaving) {
        rows?.unmark(id);
      }
      toast.error("Couldn't sign them out", {
        description: accountError(result.error, "Try again in a moment."),
      });
      return;
    }
    toast.success(
      `Signed out ${others} other ${others === 1 ? "device" : "devices"}`
    );
    router.refresh();
  }

  return (
    <SettingsSection
      action={
        others > 0 ? (
          <Button
            onClick={() => setConfirm(true)}
            pending={pending}
            size="sm"
            variant="outline"
          >
            Sign out everywhere else
          </Button>
        ) : null
      }
      description="Where you're signed in. Sign out anything you don't recognise, then change your password."
      id="sessions"
      title="Devices"
    >
      <ul className="grid" data-sessions>
        {shown.map((s) => (
          <SessionItem key={s.id} session={s} />
        ))}
      </ul>
      {hidden > 0 ? (
        <div>
          {/* -ml-3: the label's ink, not the button box, on the content edge. */}
          <Button
            className="-ml-3"
            onClick={() => setAll(true)}
            size="sm"
            variant="ghost"
          >
            Show {hidden} more
          </Button>
        </div>
      ) : null}
      <Confirm
        confirmLabel="Sign them out"
        description={`This signs you out on ${others} other ${others === 1 ? "device" : "devices"}. You stay signed in here.`}
        onConfirm={signOutOthers}
        onOpenChange={setConfirm}
        open={confirm}
        title="Sign out everywhere else?"
      />
    </SettingsSection>
  );
}

function AppearanceSection() {
  const { current, setTheme } = useThemeChoice();
  return (
    <SettingsSection
      description="Saved in this browser. System follows your device's setting."
      id="appearance"
      title="Appearance"
    >
      <Segmented
        className="w-full max-w-sm"
        label="Theme"
        onChange={(value) => setTheme(value)}
        options={THEME_OPTIONS}
        value={current}
      />
    </SettingsSection>
  );
}

function DeleteAccount({ data }: { data: AccountData }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === data.user.email;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches) {
      return;
    }
    const password = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    setError(null);
    const result = await authClient.deleteUser({ password });
    if (result.error) {
      setPending(false);
      setError(
        accountError(result.error, "Your account wasn't deleted. Try again.")
      );
      return;
    }
    toast.success("Your account was deleted");
    router.push("/");
    router.refresh();
  }

  const blocked = data.soleOwnerOf.length > 0;

  return (
    <SettingsSection
      description="Deleting your account signs you out everywhere and removes you from every organization."
      id="delete"
      title="Danger zone"
    >
      {blocked ? (
        <SettingsRow
          data-delete-blocked
          description={
            <>
              You're the only owner of{" "}
              {data.soleOwnerOf.map((o, i) => (
                <span key={o.id}>
                  {i > 0
                    ? i === data.soleOwnerOf.length - 1
                      ? " and "
                      : ", "
                    : ""}
                  <span className="font-medium text-foreground">{o.name}</span>
                </span>
              ))}
              . An organization can't be left without an owner, so transfer
              ownership to someone else or delete{" "}
              {data.soleOwnerOf.length === 1 ? "it" : "them"} first.
            </>
          }
          title="Delete account"
        >
          {data.soleOwnerOf.map((o) => (
            <Link
              className={buttonVariants({ size: "sm", variant: "outline" })}
              href={o.settingsHref}
              key={o.id}
            >
              {data.soleOwnerOf.length === 1
                ? "Open its settings"
                : `${o.name} settings`}
              <ArrowRightIcon aria-hidden />
            </Link>
          ))}
        </SettingsRow>
      ) : (
        <SettingsRow
          description="This can't be undone. Invoices stay with their organizations."
          title="Delete account"
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
            Delete account…
          </Button>
          <SettingsDialog
            description="Your account, its sessions and its memberships are deleted, and you're signed out everywhere. It can't be undone."
            onOpenChange={setOpen}
            open={open}
            title="Delete your account"
          >
            <form className="grid gap-5" onSubmit={onSubmit}>
              <TypeToConfirm
                expected={data.user.email}
                id="delete-account-confirm"
                onChange={setTyped}
                value={typed}
              />
              <div className="grid gap-2">
                <Label htmlFor="delete-account-password">Password</Label>
                <Input
                  autoComplete="current-password"
                  id="delete-account-password"
                  name="password"
                  required
                  type="password"
                />
              </div>
              {error ? <FormAlert>{error}</FormAlert> : null}
              <Button
                disabled={!matches}
                pending={pending}
                type="submit"
                variant="destructive"
              >
                Delete my account
              </Button>
            </form>
          </SettingsDialog>
        </SettingsRow>
      )}
    </SettingsSection>
  );
}

export function Account({ data }: { data: AccountData }) {
  return (
    <div className={cn("grid animate-content gap-8")}>
      <PageHeader
        description="Your profile, sign-in and devices. These follow you into every organization."
        title="Account"
      />
      <div className="grid max-w-3xl gap-6">
        <ProfileSection data={data} />
        <EmailSection data={data} />
        <PasswordSection email={data.user.email} />
        <SessionsSection data={data} />
        <AppearanceSection />
        <DeleteAccount data={data} />
      </div>
    </div>
  );
}
