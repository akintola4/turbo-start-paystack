import { Button } from "@workspace/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { MailIcon, UserPlusIcon } from "lucide-react";

import {
  CancelInvitationButton,
  CopyInviteLinkButton,
  InviteDialog,
} from "@/components/shared/member-actions";
import { MembersTable } from "@/components/shared/members-table";
import type { MembersData } from "@/directions/types";
import { formatDate, roleLabel } from "@/lib/format";
import { Meter, PageHeader, Panel } from "./ui";

function Count({ n }: { n: number }) {
  return (
    <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px font-normal text-muted-foreground text-xs tabular-nums">
      {n}
    </span>
  );
}

export function LedgerMembers({ data }: { data: MembersData }) {
  const full = data.limit.used >= data.limit.max;
  const invite = data.can.invite ? (
    <InviteDialog
      organizationId={data.org.id}
      roles={data.inviteRoles}
      seatsNote={
        <>
          {data.limit.used} of {data.limit.max} seats on {data.limit.planName}{" "}
          are taken, counting pending invites.
        </>
      }
      trigger={
        <Button disabled={full} size="sm">
          <UserPlusIcon />
          Invite member
        </Button>
      }
    />
  ) : null;

  return (
    <div className="grid gap-8">
      <PageHeader
        actions={invite}
        description={`Everyone with access to ${data.org.name}, and what they can do.`}
        title="Members"
      />

      <div className="grid gap-2 sm:max-w-sm">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">
            Seats on {data.limit.planName}
          </span>
          <span className="tabular-nums">
            <span className="font-medium">{data.limit.used}</span>
            <span className="text-muted-foreground"> of {data.limit.max}</span>
          </span>
        </div>
        <Meter
          label="Seats used"
          max={data.limit.max}
          value={data.limit.used}
        />
        {full ? (
          <p className="text-muted-foreground text-xs">
            All seats are taken. Upgrade the plan to invite more people.
          </p>
        ) : null}
      </div>

      <Tabs className="gap-5" defaultValue="members">
        <TabsList
          className="h-auto w-full justify-start gap-4 rounded-none border-b bg-transparent p-0"
          variant="line"
        >
          <TabsTrigger
            className="h-10 flex-none px-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
            value="members"
          >
            Members
            <Count n={data.members.length} />
          </TabsTrigger>
          {data.can.invite ? (
            <TabsTrigger
              className="h-10 flex-none px-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
              value="invitations"
            >
              Invitations
              <Count n={data.invitations.length} />
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="members">
          <MembersTable
            density="comfortable"
            members={data.members}
            monogramShape="circle"
            monogramTone="soft"
            organizationId={data.org.id}
            orgName={data.org.name}
            roleEditor="select"
            roles={data.assignableRoles}
            tableClassName="rounded-lg border [&_thead_button]:text-xs [&_tr>*:first-child]:pl-5 [&_tr>*:last-child]:pr-3"
          />
        </TabsContent>

        {data.can.invite ? (
          <TabsContent value="invitations">
            <Panel>
              {data.invitations.length === 0 ? (
                <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
                  <MailIcon
                    aria-hidden
                    className="size-5 text-muted-foreground"
                  />
                  <p className="font-medium text-sm">No pending invitations</p>
                  <p className="max-w-xs text-muted-foreground text-sm">
                    Invitations you send show here until they're accepted or
                    expire after 7 days.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-9 pl-5 text-muted-foreground text-xs">
                        Email
                      </TableHead>
                      <TableHead className="h-9 w-40 text-muted-foreground text-xs">
                        Role
                      </TableHead>
                      <TableHead className="hidden h-9 w-36 text-muted-foreground text-xs md:table-cell">
                        Expires
                      </TableHead>
                      <TableHead className="h-9 w-24 pr-3">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="h-14 max-w-0 truncate pl-5 font-medium">
                          {inv.email}
                        </TableCell>
                        <TableCell>{roleLabel(inv.role)}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-muted-foreground tabular-nums md:table-cell">
                          {formatDate(inv.expiresAt)}
                        </TableCell>
                        <TableCell className="pr-3">
                          <div className="flex justify-end gap-1">
                            <CopyInviteLinkButton
                              className="size-8"
                              iconOnly
                              invitationId={inv.id}
                            />
                            <CancelInvitationButton
                              className="size-8"
                              email={inv.email}
                              iconOnly
                              invitationId={inv.id}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
