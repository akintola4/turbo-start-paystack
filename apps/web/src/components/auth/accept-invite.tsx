import { buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";

import {
  AcceptInviteButton,
  SwitchAccountButton,
} from "@/components/auth/accept-invite-button";
import { MarkAvatar } from "@/components/mark-avatar";
import type { AcceptInviteData } from "@/lib/view-models";
import { roleLabel } from "@/lib/format";
import { Tile, Wordmark } from "@/components/primitives";

const PROBLEM: Record<
  NonNullable<AcceptInviteData["unusable"]>,
  { title: string; body: string }
> = {
  expired: {
    title: "This invitation has expired",
    body: "Invitations work for 7 days. Ask the person who invited you to send a new one.",
  },
  accepted: {
    title: "This invitation was already used",
    body: "If it was you, the organization is in your list once you sign in.",
  },
  revoked: {
    title: "This invitation was withdrawn",
    body: "Ask the person who invited you if they meant to send a new one.",
  },
  unknown: {
    title: "This invitation can't be found",
    body: "Check the link in the email, or ask for a new invitation.",
  },
};

export function AcceptInvite({ data }: { data: AcceptInviteData }) {
  const { invite } = data;
  const problem = data.unusable ? PROBLEM[data.unusable] : null;
  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-6 sm:px-10 sm:py-8">
      <Wordmark className="self-start" />
      <main
        className="flex flex-1 items-center justify-center py-12 outline-none"
        id="content"
        tabIndex={-1}
      >
        <Tile className="grid w-full max-w-md gap-8 p-8">
          {invite ? (
            <>
              <div className="grid justify-items-start gap-5">
                <MarkAvatar
                  className="size-16 rounded-control"
                  seed={invite.orgId}
                  size="md"
                />
                <div className="grid gap-2">
                  <h1 className="text-balance font-display font-semibold text-[32px] leading-[1.1] tracking-[-0.02em]">
                    Join {invite.orgName}
                  </h1>
                  <p className="text-muted-foreground">
                    {invite.inviter
                      ? `${invite.inviter} invited you`
                      : "You've been invited"}{" "}
                    as{" "}
                    <span className="font-medium text-foreground">
                      {roleLabel(invite.role).toLowerCase()}
                    </span>
                    . The link works for 7 days, only for {invite.forEmail}.
                  </p>
                </div>
              </div>
              {invite.otherAccount ? (
                <div className="grid gap-3">
                  <p className="rounded-control bg-warning-bg px-3.5 py-3 text-sm">
                    This invite is for{" "}
                    <span className="font-semibold">{invite.forEmail}</span>,
                    and you're signed in as{" "}
                    <span className="font-semibold">{data.signedInAs}</span>.
                  </p>
                  <SwitchAccountButton signInHref={data.hrefs.signIn} />
                </div>
              ) : data.signedIn ? (
                <div className="grid gap-3">
                  <AcceptInviteButton
                    invitationId={data.invitationId}
                    orgName={invite.orgName}
                  />
                  <p className="text-center text-muted-foreground text-sm">
                    Signed in as {data.signedInAs}
                  </p>
                </div>
              ) : (
                <SignInChoices data={data} />
              )}
            </>
          ) : (
            <div className="grid gap-4">
              <h1 className="text-balance font-display font-semibold text-[32px] leading-[1.1] tracking-[-0.02em]">
                {problem?.title}
              </h1>
              <p className="text-muted-foreground">{problem?.body}</p>
              {data.signedIn ? (
                <Link
                  className={buttonVariants({
                    variant: "outline",
                    className: "w-fit",
                  })}
                  href="/app"
                >
                  Go to your organizations
                </Link>
              ) : (
                <SignInChoices data={data} />
              )}
            </div>
          )}
        </Tile>
      </main>
    </div>
  );
}

function SignInChoices({ data }: { data: AcceptInviteData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Link
        className={buttonVariants({ className: "w-full" })}
        href={data.hrefs.signUp}
      >
        Create account
      </Link>
      <Link
        className={buttonVariants({ variant: "outline", className: "w-full" })}
        href={data.hrefs.signIn}
      >
        Sign in
      </Link>
    </div>
  );
}
