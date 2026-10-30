"use client";

import type { ReactNode } from "react";

import { MarkAvatar } from "@/components/mark-avatar";
import { MemberRowMenu, RoleSelect } from "@/components/members/member-actions";
import { useRowPresence } from "@/components/motion";
import { formatDate, roleLabel } from "@/lib/format";
import type { MemberRow, Role } from "@/lib/view-models";

function PresenceItem({ id, children }: { id: string; children: ReactNode }) {
  return (
    <li
      className="flex items-center gap-3 px-2 py-3"
      data-presence={useRowPresence(id)}
    >
      {children}
    </li>
  );
}

/** Mobile list: one row per member, the role (or its select) under the name. */
export function MemberCards({
  members,
  organizationId,
  orgName,
  roles,
}: {
  members: MemberRow[];
  organizationId: string;
  orgName: string;
  roles: Role[];
}) {
  return (
    <ul className="grid divide-y">
      {members.map((m) => (
        <PresenceItem id={m.id} key={m.id}>
          <MarkAvatar className="size-10 rounded-[11px]" seed={m.email} />
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="truncate font-medium text-sm">
              {m.name}
              {m.isMe ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  (you)
                </span>
              ) : null}
            </span>
            {m.canUpdate ? (
              <RoleSelect
                className="w-32"
                member={m}
                organizationId={organizationId}
                roles={roles}
              />
            ) : (
              <span className="truncate text-muted-foreground text-sm">
                {roleLabel(m.role)}, joined {formatDate(m.joinedAt, "short")}
              </span>
            )}
          </div>
          <MemberRowMenu
            member={m}
            organizationId={organizationId}
            orgName={orgName}
          />
        </PresenceItem>
      ))}
    </ul>
  );
}
