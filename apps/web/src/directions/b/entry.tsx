import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/tailwind-config/utils";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { AcceptInviteButton } from "@/components/shared/accept-invite-button";
import { AuthForm, AuthSwitch } from "@/components/shared/auth-form";
import { Monogram } from "@/components/shared/avatars";
import { CreateOrgForm } from "@/components/shared/create-org-form";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/shared/user-menu";
import type { AcceptInviteData, OrgPickerData } from "@/directions/types";
import { roleLabel, STATUS_META } from "@/lib/format";
import { Mark, Pill } from "./primitives";

/** Narrow centered column on a restrained dot field. */
function Frame({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="b-dots relative flex min-h-dvh flex-col bg-background">
      <header className="flex h-14 items-center justify-between px-5 md:px-8">
        <Link
          aria-label="Turbo Start Paystack home"
          className="flex items-center gap-2 rounded-sm font-semibold text-[14px] tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/"
        >
          <Mark />
          <span className="hidden sm:inline">Turbo Start Paystack</span>
        </Link>
        <ThemeToggle className="size-8 text-muted-foreground" />
      </header>
      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col justify-center px-5 pb-24",
          wide ? "max-w-[640px]" : "max-w-[392px]"
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function Auth({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <Frame>
      <div className="grid gap-8 rounded-xl border bg-card p-6 shadow-[0_24px_48px_-32px_oklch(0_0_0/0.4)] sm:p-8">
        <div className="grid gap-1.5">
          <h1 className="font-display font-semibold text-[22px] leading-7 tracking-[-0.02em]">
            {mode === "sign-in" ? "Sign in" : "Create your account"}
          </h1>
          <p className="text-[13.5px] text-muted-foreground leading-5">
            {mode === "sign-in"
              ? "Use the email and password you signed up with."
              : "We'll email you a link to verify your address."}
          </p>
        </div>
        <AuthForm
          footer={<AuthSwitch className="text-[13px]" mode={mode} />}
          mode={mode}
        />
      </div>
      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        Email and password only in v1. Sessions are HTTP-only cookies.
      </p>
    </Frame>
  );
}

export function AcceptInvite({ data }: { data: AcceptInviteData }) {
  const { invite } = data;
  return (
    <Frame>
      <div className="grid gap-6 rounded-xl border bg-card p-6 sm:p-8">
        {invite ? (
          <>
            <div className="flex items-center gap-3">
              <Monogram
                className="size-10 rounded-md bg-foreground text-background text-sm"
                name={invite.orgName}
                tone="mono"
              />
              <div className="grid min-w-0 gap-0.5">
                <h1 className="truncate font-display font-semibold text-[18px] tracking-[-0.015em]">
                  Join {invite.orgName}
                </h1>
                <p className="text-[13px] text-muted-foreground">
                  {invite.inviter
                    ? `${invite.inviter} invited you`
                    : "You were invited"}{" "}
                  as {roleLabel(invite.role).toLowerCase()}.
                </p>
              </div>
            </div>
            <dl className="grid gap-px overflow-hidden rounded-md border bg-border text-[13px]">
              <div className="flex justify-between gap-4 bg-card px-3 py-2">
                <dt className="text-muted-foreground">Role</dt>
                <dd>{roleLabel(invite.role)}</dd>
              </div>
              <div className="flex justify-between gap-4 bg-card px-3 py-2">
                <dt className="text-muted-foreground">Works for</dt>
                <dd className="truncate">
                  {invite.email || "The invited address only"}
                </dd>
              </div>
            </dl>
            {data.signedIn ? (
              <div className="grid gap-3">
                <AcceptInviteButton invitationId={data.invitationId} />
                <p className="text-[12px] text-muted-foreground">
                  Signed in as {data.signedInAs}.
                </p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild>
                  <Link href={data.hrefs.signUp}>Create account</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={data.hrefs.signIn}>Sign in</Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <h1 className="font-display font-semibold text-[18px] tracking-[-0.015em]">
                This invitation can't be used
              </h1>
              <p className="text-[13.5px] text-muted-foreground leading-5">
                It may have expired, been revoked or already accepted. Ask
                whoever invited you to send a new one.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={data.signedIn ? "/app" : "/sign-in"}>
                {data.signedIn ? "Go to your organizations" : "Sign in"}
              </Link>
            </Button>
          </div>
        )}
      </div>
      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        Invitations work only for the address they were sent to and expire after
        7 days.
      </p>
    </Frame>
  );
}

export function OrgPicker({ data }: { data: OrgPickerData }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-12 max-w-[720px] items-center gap-3 px-5">
          <Link
            aria-label="Home"
            className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            <Mark />
          </Link>
          <span aria-hidden className="text-muted-foreground/50">
            /
          </span>
          <span className="font-medium text-[13px]">Organizations</span>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle className="size-8 text-muted-foreground" />
            <UserMenu user={data.user}>
              <button
                aria-label={`Account: ${data.user.name}`}
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
              >
                <Monogram
                  className="size-7 text-[10px]"
                  name={data.user.name}
                  shape="circle"
                  tone="mono"
                />
              </button>
            </UserMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto grid max-w-[720px] gap-10 px-5 py-12">
        <div className="grid gap-1">
          <h1 className="font-display font-semibold text-[22px] leading-7 tracking-[-0.02em]">
            Choose an organization
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Signed in as {data.user.email}
            {data.user.emailVerified
              ? ""
              : ". Verify your email to accept invitations"}
          </p>
        </div>

        {data.orgs.length ? (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {data.orgs.map((org) => {
              const status = STATUS_META[org.status ?? "free"];
              return (
                <li key={org.id}>
                  <Link
                    className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-0 sm:grid-cols-[auto_minmax(0,1fr)_120px_96px_16px]"
                    href={`/app/${org.slug}`}
                  >
                    <Monogram
                      className="size-8 rounded-md bg-foreground text-background"
                      name={org.name}
                      seed={org.slug}
                      tone="mono"
                    />
                    <span className="grid min-w-0">
                      <span className="truncate font-medium text-[14px]">
                        {org.name}
                      </span>
                      <span className="truncate text-[12.5px] text-muted-foreground">
                        {roleLabel(org.role)}, {org.memberCount}{" "}
                        {org.memberCount === 1 ? "member" : "members"}
                      </span>
                    </span>
                    <span className="hidden text-[13px] text-muted-foreground sm:block">
                      {org.planName}
                    </span>
                    <span className="hidden sm:block">
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </span>
                    <ChevronRightIcon
                      aria-hidden
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid justify-items-start gap-2 rounded-lg border border-dashed p-6">
            <p className="font-medium text-[14px]">No organizations yet</p>
            <p className="text-[13px] text-muted-foreground">
              Create one below, or open an invitation link someone sent you.
            </p>
          </div>
        )}

        <section
          aria-labelledby="new-title"
          className="grid gap-4 border-t pt-8"
          id="new"
        >
          <div className="grid gap-1">
            <h2 className="font-medium text-[14px]" id="new-title">
              New organization
            </h2>
            <p className="text-[13px] text-muted-foreground">
              You'll be its owner and can invite people once it exists.
            </p>
          </div>
          <CreateOrgForm />
        </section>
      </main>
    </div>
  );
}

export function PageLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="grid gap-8"
      role="status"
    >
      <div className="flex items-end justify-between border-b pb-5">
        <div className="grid gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div className="grid gap-2 bg-background p-4" key={i}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton className="h-9 w-full" key={i} />
        ))}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function ConfirmingPayment() {
  return (
    <Frame>
      <div
        className="grid justify-items-center gap-4 text-center"
        role="status"
      >
        <span className="flex size-10 items-center justify-center rounded-full border bg-card">
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
        </span>
        <div className="grid gap-1">
          <h1 className="font-display font-semibold text-[18px] tracking-[-0.015em]">
            Confirming with Paystack
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Verifying the transaction on the server. This takes a few seconds.
          </p>
        </div>
        <p className="font-mono text-[11.5px] text-muted-foreground">
          GET /transaction/verify
        </p>
      </div>
    </Frame>
  );
}

export function NotFound() {
  return (
    <Frame>
      <div className="grid justify-items-start gap-4">
        <p className="font-mono text-[12px] text-muted-foreground">404</p>
        <div className="grid gap-1.5">
          <h1 className="font-display font-semibold text-[22px] tracking-[-0.02em]">
            Nothing here
          </h1>
          <p className="text-[13.5px] text-muted-foreground leading-5">
            The page doesn't exist, or it belongs to an organization you're not
            a member of.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href="/app">Your organizations</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </Frame>
  );
}
