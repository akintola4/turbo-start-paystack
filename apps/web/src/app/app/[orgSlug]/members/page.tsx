import { ROLE_RANK, type Role, rankOf } from "@workspace/auth/permissions";
import { schema } from "@workspace/db";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { and, eq, gt } from "drizzle-orm";

import {
  CancelInvitationButton,
  InviteForm,
  MemberRoleSelect,
  RemoveMemberButton,
} from "@/components/members-manager";
import { getServerContext } from "@/server/context";
import { requireOrgBySlug } from "@/server/session";

export const metadata = { title: "Members" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization, member: me, can } = await requireOrgBySlug(orgSlug);
  const { db } = getServerContext();

  // Every query is scoped by the organization resolved from the slug and the
  // caller's membership, never by an id from the client.
  const members = await db
    .select({
      id: schema.member.id,
      role: schema.member.role,
      email: schema.user.email,
      name: schema.user.name,
    })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, organization.id))
    .orderBy(schema.member.createdAt);

  const canInvite = can("invitation:create");
  const invitations = canInvite
    ? await db
        .select({
          id: schema.invitation.id,
          email: schema.invitation.email,
          role: schema.invitation.role,
          expiresAt: schema.invitation.expiresAt,
        })
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.organizationId, organization.id),
            eq(schema.invitation.status, "pending"),
            gt(schema.invitation.expiresAt, new Date())
          )
        )
    : [];

  const myRank = rankOf(me.role);
  const assignableRoles = (Object.keys(ROLE_RANK) as Role[]).filter(
    (role) => ROLE_RANK[role] <= myRank
  );
  const canUpdate = can("member:update");
  const canRemove = can("member:delete");

  return (
    <div className="grid gap-6">
      <h1 className="font-semibold text-2xl">Members</h1>
      {canInvite ? (
        <Card>
          <CardHeader>
            <CardTitle>Invite someone</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm
              assignableRoles={assignableRoles.filter(
                (r) => r !== "owner" || myRank >= ROLE_RANK.owner
              )}
              organizationId={organization.id}
            />
          </CardContent>
        </Card>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => {
            const manageable = m.id !== me.id && rankOf(m.role) <= myRank;
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div>{m.name}</div>
                  <div className="text-muted-foreground text-xs">{m.email}</div>
                </TableCell>
                <TableCell>
                  {canUpdate && manageable ? (
                    <MemberRoleSelect
                      assignableRoles={assignableRoles}
                      memberId={m.id}
                      organizationId={organization.id}
                      role={m.role}
                    />
                  ) : (
                    m.role
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canRemove && manageable ? (
                    <RemoveMemberButton
                      memberId={m.id}
                      organizationId={organization.id}
                    />
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {canInvite && invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm">
              {invitations.map((inv) => (
                <li className="flex items-center justify-between" key={inv.id}>
                  <span>
                    {inv.email} · {inv.role} · expires{" "}
                    {inv.expiresAt.toISOString().slice(0, 10)}
                  </span>
                  <CancelInvitationButton invitationId={inv.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
