import { buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";

import { AcceptInviteButton } from "@/components/auth/accept-invite-button";
import { Monogram } from "@/components/avatars";
import type { AcceptInviteData } from "@/lib/view-models";
import { roleLabel } from "@/lib/format";
import { Tile, Wordmark } from "@/components/primitives";

export function AcceptInvite({ data }: { data: AcceptInviteData }) {
  const { invite } = data;
  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-6 sm:px-10 sm:py-8">
      <Wordmark />
      <main className="flex flex-1 items-center justify-center py-12">
        <Tile className="grid w-full max-w-md gap-8 p-8">
          {invite ? (
            <>
              <div className="grid justify-items-start gap-5">
                <Monogram
                  className="size-16 rounded-control text-xl"
                  name={invite.orgName}
                  seed={invite.orgSlug}
                  tone="solid"
                />
                <div className="grid gap-2">
                  <h1 className="text-balance font-semibold text-[28px] leading-tight tracking-[-0.02em]">
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
                    . The link works for 7 days, only for the address it was
                    sent to.
                  </p>
                </div>
              </div>
              {data.signedIn ? (
                <div className="grid gap-3">
                  <AcceptInviteButton
                    orgName={invite.orgName}
                    className="w-full"
                    invitationId={data.invitationId}
                    label={`Join ${invite.orgName}`}
                  />
                  <p className="text-center text-muted-foreground text-sm">
                    Signed in as {data.signedInAs}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    className={buttonVariants({
                      className: "w-full",
                    })}
                    href={data.hrefs.signUp}
                  >
                    Create account
                  </Link>
                  <Link
                    className={buttonVariants({
                      variant: "outline",
                      className: "w-full",
                    })}
                    href={data.hrefs.signIn}
                  >
                    Sign in
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="grid gap-4">
              <h1 className="font-semibold text-[28px] leading-tight tracking-[-0.02em]">
                This invitation can't be used
              </h1>
              <p className="text-muted-foreground">
                It may have expired, been revoked or already accepted. Ask the
                person who invited you to send a new one.
              </p>
              <Link
                className={buttonVariants({
                  variant: "outline",
                  className: "w-fit",
                })}
                href="/app"
              >
                Go to your organizations
              </Link>
            </div>
          )}
        </Tile>
      </main>
    </div>
  );
}
