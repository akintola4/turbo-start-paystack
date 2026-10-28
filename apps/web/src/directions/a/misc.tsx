import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
  BuildingIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  Loader2Icon,
  MailWarningIcon,
} from "lucide-react";
import Link from "next/link";

import { AcceptInviteButton } from "@/components/shared/accept-invite-button";
import { Monogram } from "@/components/shared/avatars";
import { CreateOrgForm } from "@/components/shared/create-org-form";
import { UserMenu } from "@/components/shared/user-menu";
import type { AcceptInviteData, OrgPickerData } from "@/directions/types";
import { roleLabel, STATUS_META } from "@/lib/format";
import { AuthFrame } from "./auth";
import { PageHeader, Panel, Pill, Section, Wordmark } from "./ui";

/* ----------------------------------------------------------- accept invite */

export function LedgerAcceptInvite({ data }: { data: AcceptInviteData }) {
  const { invite } = data;
  return (
    <AuthFrame
      aside={
        <div className="grid gap-3 text-sm">
          <h2 className="font-display font-semibold text-xl tracking-tight">
            How invitations work
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            An invitation only works for the email address it was sent to, and
            expires after 7 days. Once you accept, the organization shows up in
            your list and you can switch to it from the sidebar.
          </p>
        </div>
      }
    >
      {invite ? (
        <div className="grid gap-8">
          <div className="grid gap-5">
            <Monogram
              className="size-11 text-sm"
              name={invite.orgName}
              tone="mono"
            />
            <div className="grid gap-1.5">
              <h1 className="font-display font-semibold text-2xl tracking-tight">
                Join {invite.orgName}
              </h1>
              <p className="text-muted-foreground text-sm">
                {invite.inviter
                  ? `${invite.inviter} invited you`
                  : "You've been invited"}{" "}
                as{" "}
                {roleLabel(invite.role).toLowerCase() === "admin"
                  ? "an admin"
                  : `a ${roleLabel(invite.role).toLowerCase()}`}
                .
              </p>
            </div>
          </div>
          {data.signedIn ? (
            <div className="grid gap-3">
              <AcceptInviteButton invitationId={data.invitationId} />
              <p className="text-muted-foreground text-xs">
                Signed in as {data.signedInAs}. The invitation must be for this
                address.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <Button asChild className="w-full">
                <Link href={data.hrefs.signUp}>
                  Create an account to accept
                </Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href={data.hrefs.signIn}>I already have an account</Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-6">
          <MailWarningIcon
            aria-hidden
            className="size-6 text-muted-foreground"
          />
          <div className="grid gap-1.5">
            <h1 className="font-display font-semibold text-2xl tracking-tight">
              This invitation can't be used
            </h1>
            <p className="text-muted-foreground text-sm">
              It was already accepted, revoked, or it expired. Ask the person
              who invited you to send a new one.
            </p>
          </div>
          <Button asChild className="w-fit" variant="outline">
            <Link href="/app">Go to your organizations</Link>
          </Button>
        </div>
      )}
    </AuthFrame>
  );
}

/* --------------------------------------------------------------- org picker */

export function LedgerOrgPicker({ data }: { data: OrgPickerData }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-6">
          <Link
            aria-label="Turbo Start Paystack home"
            className="flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            <Wordmark />
          </Link>
          <UserMenu user={data.user}>
            <Button className="h-9 gap-2 px-2" variant="ghost">
              <Monogram
                className="size-6 text-[10px]"
                name={data.user.name}
                seed={data.user.email}
                shape="circle"
              />
              <span className="hidden max-w-40 truncate sm:inline">
                {data.user.name}
              </span>
              <ChevronsUpDownIcon className="text-muted-foreground" />
            </Button>
          </UserMenu>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-3xl gap-12 px-6 pt-12 pb-24">
        <PageHeader
          description={
            data.user.emailVerified
              ? `Signed in as ${data.user.email}`
              : `Signed in as ${data.user.email}. Verify your email to accept invitations.`
          }
          title="Organizations"
        />
        <Panel>
          {data.orgs.length === 0 ? (
            <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
              <BuildingIcon
                aria-hidden
                className="size-5 text-muted-foreground"
              />
              <p className="font-medium text-sm">No organizations yet</p>
              <p className="max-w-xs text-muted-foreground text-sm">
                Create one below, or accept an invitation from a teammate.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {data.orgs.map((org) => {
                const status = org.status
                  ? STATUS_META[org.status]
                  : STATUS_META.free;
                return (
                  <li key={org.id}>
                    <Link
                      className="group flex h-16 items-center gap-4 px-5 outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      href={`/app/${org.slug}`}
                    >
                      <Monogram
                        className="size-9"
                        name={org.name}
                        seed={org.slug}
                        tone="solid"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-sm">
                          {org.name}
                        </p>
                        <p className="truncate text-muted-foreground text-xs">
                          {roleLabel(org.role)}, {org.memberCount}{" "}
                          {org.memberCount === 1 ? "member" : "members"}
                        </p>
                      </div>
                      <span className="hidden w-16 text-right text-sm sm:block">
                        {org.planName}
                      </span>
                      <span className="hidden w-36 sm:flex sm:justify-end">
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
          )}
        </Panel>
        <div className="scroll-mt-8" id="new">
          <Section title="New organization">
            <Panel className="p-5">
              <CreateOrgForm />
            </Panel>
          </Section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function LedgerPageLoading() {
  return (
    <div aria-busy className="grid gap-10">
      <span className="sr-only" role="status">
        Loading
      </span>
      <div className="grid gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div className="grid gap-3 bg-card p-5" key={i}>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="grid gap-4 lg:col-span-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
        <div className="grid gap-4 lg:col-span-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function LedgerConfirmingPayment() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div
        className="grid w-full max-w-sm justify-items-center gap-4 rounded-xl border bg-card px-8 py-10 text-center"
        role="status"
      >
        <Loader2Icon
          aria-hidden
          className="size-5 animate-spin text-(--ledger-accent)"
        />
        <div className="grid gap-1">
          <h1 className="font-semibold">Confirming your payment</h1>
          <p className="text-muted-foreground text-sm">
            Checking the reference with Paystack. This takes a few seconds.
          </p>
        </div>
      </div>
    </main>
  );
}

export function LedgerNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="grid w-full max-w-sm gap-6">
        <Wordmark />
        <div className="grid gap-1.5">
          <p className="font-medium text-muted-foreground text-sm tabular-nums">
            404
          </p>
          <h1 className="font-display font-semibold text-2xl tracking-tight">
            Page not found
          </h1>
          <p className="text-muted-foreground text-sm">
            It doesn't exist, or it belongs to an organization you're not a
            member of.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/app">Your organizations</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
