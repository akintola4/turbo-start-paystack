"use client";

import type { ReactNode } from "react";

import { Monogram } from "@/components/avatars";
import { useRowPresence } from "@/components/motion";
import { MemberRowMenu } from "@/components/members/member-actions";
import type { MemberRow, Role } from "@/lib/view-models";
import { formatDate, roleLabel } from "@/lib/format";

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

/** Mobile list: one row per member, role under the name, actions in a menu. */
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
          <Monogram
            className="size-10"
            name={m.name}
            seed={m.email}
            shape="circle"
          />
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
            <span className="truncate text-muted-foreground text-xs">
              {roleLabel(m.role)}, joined {formatDate(m.joinedAt, "short")}
            </span>
          </div>
          <MemberRowMenu
            member={m}
            organizationId={organizationId}
            orgName={orgName}
            roles={roles}
            triggerClassName="rounded-full"
          />
        </PresenceItem>
      ))}
    </ul>
  );
}
