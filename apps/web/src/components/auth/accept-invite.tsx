import { Button, buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";

import { AcceptInviteButton } from "@/components/auth/accept-invite-button";
import { Monogram } from "@/components/avatars";
import type { AcceptInviteData } from "@/lib/view-models";
import { roleLabel } from "@/lib/format";
import { Tile, Wordmark } from "@/components/primitives";

/** Same seed as the org's slug, so the monogram color matches the rest of the app. */
const orgSeed = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export function AcceptInvite({ data }: { data: AcceptInviteData }) {
  const { invite } = data;
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--c-canvas)] px-4 py-6 sm:px-10 sm:py-8">
      <Wordmark />
      <main className="flex flex-1 items-center justify-center py-12">
        <Tile className="grid w-full max-w-md gap-8 p-8">
          {invite ? (
            <>
              <div className="grid justify-items-start gap-5">
                <Monogram
                  className="size-16 rounded-[18px] font-display text-xl"
                  name={invite.orgName}
                  seed={orgSeed(invite.orgName)}
                  tone="solid"
                />
                <div className="grid gap-2">
                  <h1 className="text-balance font-display font-semibold text-[28px] leading-tight tracking-tight">
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
                    className="h-11 rounded-full text-[15px]"
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
                      className: "h-11 rounded-full",
                    })}
                    href={data.hrefs.signUp}
                  >
                    Create account
                  </Link>
                  <Link
                    className={buttonVariants({
                      variant: "outline",
                      className: "h-11 rounded-full",
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
              <h1 className="font-display font-semibold text-[28px] leading-tight tracking-tight">
                This invitation can't be used
              </h1>
              <p className="text-muted-foreground">
                It may have expired, been revoked or already accepted. Ask the
                person who invited you to send a new one.
              </p>
              <Link
                className={buttonVariants({
                  variant: "outline",
                  className: "h-11 w-fit rounded-full px-5",
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
