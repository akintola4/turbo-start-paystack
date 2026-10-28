import { Suspense } from "react";

import { MembersTable } from "@/components/shared/members-table";
import {
  CancelInvitationButton,
  CopyInviteLinkButton,
} from "@/components/shared/member-actions";
import type { MembersData } from "@/directions/types";
import { daysUntil, formatDate, roleLabel } from "@/lib/format";
import { InviteLauncher } from "./invite-launcher";
import { PageHeader } from "./primitives";

export function Members({ data }: { data: MembersData }) {
  const left = Math.max(0, data.limit.max - data.limit.used);
  const pct = Math.min(
    100,
    Math.round((data.limit.used / Math.max(1, data.limit.max)) * 100)
  );
  const seatsNote = `${left} of ${data.limit.max} seats left on ${data.limit.planName}. Pending invitations hold a seat.`;

  return (
    <div className="grid gap-8">
      <PageHeader
        actions={
          data.can.invite ? (
            <Suspense>
              <InviteLauncher
                organizationId={data.org.id}
                roles={data.inviteRoles}
                seatsNote={seatsNote}
              />
            </Suspense>
          ) : null
        }
        description={`${data.members.length} ${data.members.length === 1 ? "member" : "members"} in ${data.org.name}.`}
        title="Members"
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <span className="text-muted-foreground">Seats</span>
        <div
          aria-label={`${data.limit.used} of ${data.limit.max} seats used`}
          aria-valuemax={data.limit.max}
          aria-valuemin={0}
          aria-valuenow={data.limit.used}
          className="h-1 w-40 overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-foreground/70"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="tabular-nums">
          {data.limit.used} / {data.limit.max}
        </span>
        <span className="text-muted-foreground">
          including pending invitations, on {data.limit.planName}
        </span>
      </div>

      <MembersTable
        density="compact"
        members={data.members}
        monogramShape="circle"
        monogramTone="mono"
        organizationId={data.org.id}
        orgName={data.org.name}
        roleEditor="select"
        roles={data.assignableRoles}
        tableClassName="rounded-lg border [&_table]:table-fixed [&_th:nth-child(2)]:w-32 sm:[&_th:nth-child(2)]:w-40 [&_tr:last-child]:border-b-0 [&_th]:px-3 [&_td]:px-3 [&_th:last-child]:w-16 [&_th_button]:-ml-2.5 [&_th_button]:h-6 [&_th_button]:text-[12px] [&_[data-slot=select-trigger]]:-ml-2 [&_[data-slot=select-trigger]]:border-transparent [&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:px-2 [&_[data-slot=select-trigger]]:shadow-none [&_[data-slot=select-trigger]:hover]:border-input dark:[&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:h-7! [&_[data-slot=select-trigger]]:text-[13px]"
      />

      {data.can.invite ? (
        <section aria-labelledby="invites-title" className="grid gap-3">
          <div className="flex h-7 items-center justify-between">
            <h2 className="font-medium text-[14px]" id="invites-title">
              Pending invitations
            </h2>
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
              {data.invitations.length}
            </span>
          </div>
          {data.invitations.length ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full table-fixed text-[13px]">
                <thead>
                  <tr className="border-b text-left text-[12px] text-muted-foreground">
                    <th className="h-9 px-3 font-medium">Email</th>
                    <th className="h-9 w-32 px-3 font-medium sm:w-40">Role</th>
                    <th className="hidden h-9 w-36 px-3 font-medium md:table-cell">
                      Expires
                    </th>
                    <th className="h-9 w-16 px-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.invitations.map((inv) => {
                    const days = daysUntil(inv.expiresAt);
                    return (
                      <tr key={inv.id}>
                        <td className="h-10 max-w-0 truncate px-3">
                          {inv.email}
                        </td>
                        <td className="h-10 px-3">{roleLabel(inv.role)}</td>
                        <td className="hidden h-10 px-3 font-mono text-[12px] text-muted-foreground tabular-nums md:table-cell">
                          {formatDate(inv.expiresAt, "short")}
                          {days !== null ? ` (${days}d)` : ""}
                        </td>
                        <td className="h-10 px-2">
                          <div className="flex justify-end gap-0.5">
                            <CopyInviteLinkButton
                              className="size-7"
                              iconOnly
                              invitationId={inv.id}
                            />
                            <CancelInvitationButton
                              className="size-7"
                              email={inv.email}
                              iconOnly
                              invitationId={inv.id}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-5 text-[13px] text-muted-foreground">
              No pending invitations.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
