import { buttonVariants } from "@workspace/ui/components/button";
import { Progress } from "@workspace/ui/components/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { MailIcon } from "lucide-react";
import Link from "next/link";

import { InviteForm } from "@/components/members/member-actions";
import { MembersTable } from "@/components/members/members-table";
import type { MembersData } from "@/lib/view-models";
import { daysUntil, formatDate, roleLabel } from "@/lib/format";
import { InvitationMenu } from "@/components/members/invitation-menu";
import { AnimatedNumber } from "@/components/animated-number";
import { MemberCards } from "@/components/members/member-cards";
import { PresenceTableRow, RowPresenceProvider } from "@/components/motion";
import { Chip, PageHeader, Tile } from "@/components/primitives";

// Inactive labels at 75% ink: muted-foreground on surface-3 is 4.2:1, under AA.
const TAB =
  "h-9 flex-1 gap-2 rounded-chip px-4 font-semibold text-foreground/75 before:absolute before:-inset-y-1 before:inset-x-0 data-[active]:bg-surface-1 data-[active]:shadow-tile dark:data-[active]:bg-surface-3 sm:flex-none";

/** The invite form, or at the seat limit, the way to more seats. */
function InviteTile({ data }: { data: MembersData }) {
  const { full } = data.limit;
  return (
    <Tile className="grid gap-5 lg:col-span-2" id="invite">
      <div className="grid gap-1">
        <h2 className="font-semibold text-lg">Invite a teammate</h2>
        <p className="text-muted-foreground text-sm">
          The link works for 7 days and only for the address you enter.
        </p>
      </div>
      {full ? (
        <div
          className="grid justify-items-start gap-4 rounded-card bg-surface-2 p-4"
          role="status"
        >
          <p className="text-sm">
            Every seat on {data.limit.planName} is taken, pending invitations
            included.{" "}
            {data.can.manageBilling
              ? "Add seats with a bigger plan, or remove someone."
              : "Ask an owner or billing manager to add seats, or remove someone."}
          </p>
          {data.can.manageBilling && data.billingHref ? (
            <Link
              className={buttonVariants()}
              href={`${data.billingHref}#plans`}
            >
              Add seats
            </Link>
          ) : null}
        </div>
      ) : (
        <InviteForm organizationId={data.org.id} roles={data.inviteRoles} />
      )}
    </Tile>
  );
}

export function Members({ data }: { data: MembersData }) {
  const { full, pct } = data.limit;
  return (
    <div className="grid animate-content gap-8">
      <PageHeader
        description={`Everyone with access to ${data.org.name}, and what they can do.`}
        title="Members"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {data.can.invite ? <InviteTile data={data} /> : null}
        <Tile
          className={
            data.can.invite
              ? "grid content-between gap-4"
              : "grid gap-4 lg:col-span-3"
          }
        >
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-muted-foreground text-sm">
              Seats on {data.limit.planName}
            </h2>
            {full ? <Chip variant="warning">Full</Chip> : null}
          </div>
          <p className="tabular-nums leading-none">
            <span className="font-semibold text-[40px] tracking-[-0.02em]">
              <AnimatedNumber value={data.limit.used} />
            </span>
            <span className="text-muted-foreground text-xl">
              {" "}
              of {data.limit.max}
            </span>
          </p>
          <div className="grid gap-2">
            <Progress
              aria-label="Seats used"
              className="h-2 bg-muted"
              value={pct}
            />
            <p className="text-muted-foreground text-sm">
              Pending invitations count toward the limit.
            </p>
          </div>
        </Tile>
      </div>

      <Tile className="p-4 sm:p-6">
        <Tabs className="gap-5" defaultValue="people">
          <TabsList className="h-11 w-full rounded-control bg-surface-3 p-1 dark:bg-surface-1 dark:shadow-tile sm:w-fit">
            <TabsTrigger className={TAB} value="people">
              People
              <span className="text-muted-foreground tabular-nums">
                <AnimatedNumber value={data.members.length} />
              </span>
            </TabsTrigger>
            {data.can.invite ? (
              <TabsTrigger className={TAB} value="invitations">
                Invitations
                <span className="text-muted-foreground tabular-nums">
                  <AnimatedNumber value={data.invitations.length} />
                </span>
              </TabsTrigger>
            ) : null}
          </TabsList>
          <TabsContent value="people">
            <RowPresenceProvider ids={data.members.map((m) => m.id)}>
              <div className="hidden md:block">
                <MembersTable
                  members={data.members}
                  organizationId={data.org.id}
                  orgName={data.org.name}
                  roles={data.assignableRoles}
                />
              </div>
              <div className="md:hidden">
                <MemberCards
                  members={data.members}
                  organizationId={data.org.id}
                  orgName={data.org.name}
                  roles={data.assignableRoles}
                />
              </div>
            </RowPresenceProvider>
          </TabsContent>
          {data.can.invite ? (
            <TabsContent value="invitations">
              {data.invitations.length ? (
                <RowPresenceProvider ids={data.invitations.map((i) => i.id)}>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-9 text-muted-foreground text-xs">
                          Invitee
                        </TableHead>
                        <TableHead className="h-9 w-40 text-muted-foreground text-xs">
                          Role
                        </TableHead>
                        <TableHead className="hidden h-9 w-36 text-muted-foreground text-xs md:table-cell">
                          Expires
                        </TableHead>
                        <TableHead className="h-9 w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.invitations.map((inv) => {
                        const days = daysUntil(inv.expiresAt);
                        return (
                          <PresenceTableRow id={inv.id} key={inv.id}>
                            <TableCell className="h-14 w-full max-w-0 py-2.5">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-chip bg-surface-3 text-muted-foreground">
                                  <MailIcon aria-hidden className="size-4" />
                                </span>
                                <span className="grid min-w-0">
                                  <span className="truncate font-medium">
                                    {inv.email}
                                  </span>
                                  <span className="text-muted-foreground text-sm tabular-nums md:hidden">
                                    Expires {formatDate(inv.expiresAt, "short")}
                                  </span>
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="h-14 py-2.5">
                              <Chip>{roleLabel(inv.role)}</Chip>
                            </TableCell>
                            <TableCell className="hidden h-14 py-2.5 text-muted-foreground tabular-nums md:table-cell">
                              {formatDate(inv.expiresAt)}
                              {days !== null && days <= 2 ? " (soon)" : ""}
                            </TableCell>
                            <TableCell className="h-14 py-2.5">
                              <div className="flex justify-end">
                                <InvitationMenu
                                  email={inv.email}
                                  invitationId={inv.id}
                                />
                              </div>
                            </TableCell>
                          </PresenceTableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </RowPresenceProvider>
              ) : (
                <div className="grid justify-items-start gap-3 rounded-card bg-muted/60 p-5">
                  <p className="text-sm">No one is waiting to join.</p>
                  <a
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                    href="#invite"
                  >
                    Invite someone
                  </a>
                </div>
              )}
            </TabsContent>
          ) : null}
        </Tabs>
      </Tile>
    </div>
  );
}
