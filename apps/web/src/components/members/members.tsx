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

import { InviteForm } from "@/components/members/member-actions";
import { MembersTable } from "@/components/members/members-table";
import type { MembersData } from "@/lib/view-models";
import { daysUntil, formatDate, roleLabel } from "@/lib/format";
import { InvitationMenu } from "@/components/members/invitation-menu";
import { AnimatedNumber } from "@/components/animated-number";
import { MemberCards } from "@/components/members/member-cards";
import { PresenceTableRow, RowPresenceProvider } from "@/components/motion";
import { Chip, PageHeader, Tile } from "@/components/primitives";

const TAB =
  "h-9 flex-1 gap-2 rounded-chip px-4 font-semibold data-[active]:bg-surface-1 data-[active]:shadow-tile dark:data-[active]:bg-surface-3 sm:flex-none";

export function Members({ data }: { data: MembersData }) {
  const pct = Math.min(
    100,
    Math.round((data.limit.used / data.limit.max) * 100)
  );
  const full = data.limit.used >= data.limit.max;
  return (
    <div className="grid animate-content gap-8">
      <PageHeader
        description={`Everyone with access to ${data.org.name}, and what they can do.`}
        title="Members"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {data.can.invite ? (
          <Tile
            className="grid gap-5 bg-primary/[0.06] dark:bg-primary/[0.08] lg:col-span-2"
            id="invite"
          >
            <div className="grid gap-1">
              <h2 className="font-semibold text-lg">Invite a teammate</h2>
              <p className="text-muted-foreground text-sm">
                The link works for 7 days and only for the address you enter.
              </p>
            </div>
            {full ? (
              <p className="text-sm" role="status">
                You're using every seat on {data.limit.planName}. Upgrade the
                plan or remove someone to invite more people.
              </p>
            ) : (
              <InviteForm
                organizationId={data.org.id}
                roles={data.inviteRoles}
              />
            )}
          </Tile>
        ) : null}
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
            <p className="text-muted-foreground text-xs">
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
                  monogramShape="circle"
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
                                <span className="truncate font-medium">
                                  {inv.email}
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
                      className: "",
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
