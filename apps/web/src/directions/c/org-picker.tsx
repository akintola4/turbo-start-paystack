import { Button } from "@workspace/ui/components/button";
import { UsersIcon } from "lucide-react";
import Link from "next/link";

import { Monogram } from "@/components/shared/avatars";
import { CreateOrgForm } from "@/components/shared/create-org-form";
import { UserMenu } from "@/components/shared/user-menu";
import type { OrgPickerData } from "@/directions/types";
import { roleLabel, STATUS_META } from "@/lib/format";
import { Chip, PageHeader, Tile, Wordmark } from "./ui";

export function OrgPicker({ data }: { data: OrgPickerData }) {
  const first = data.user.name.split(" ")[0] ?? data.user.name;
  return (
    <div className="min-h-dvh bg-[var(--c-canvas)]">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <Wordmark href="/app" />
        <UserMenu align="end" contentClassName="w-60" user={data.user}>
          <Button
            aria-label="Account menu"
            className="-mr-3 h-10 gap-2 rounded-full pr-3 pl-1"
            variant="ghost"
          >
            <Monogram
              className="size-8"
              name={data.user.name}
              seed={data.user.email}
              shape="circle"
            />
            <span className="hidden text-sm sm:inline">{first}</span>
          </Button>
        </UserMenu>
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-4 pt-6 pb-24 sm:px-6 sm:pt-10">
        <PageHeader
          description={
            data.user.emailVerified
              ? "Pick one to continue, or start a new one below."
              : `Check ${data.user.email} for a verification link. Some actions wait for it.`
          }
          title={data.orgs.length ? "Your organizations" : `Welcome, ${first}`}
        />
        {data.orgs.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.orgs.map((org) => {
              const status = STATUS_META[org.status ?? "free"];
              return (
                <li key={org.id}>
                  <Link
                    className="group grid h-full gap-6 rounded-[20px] border bg-card p-6 shadow-[var(--c-shadow)] outline-none transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    href={`/app/${org.slug}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Monogram
                        className="size-12 rounded-[14px] font-display text-base"
                        name={org.name}
                        seed={org.slug}
                        tone="solid"
                      />
                      <Chip tone={status.tone}>
                        {org.status ? status.label : "Free"}
                      </Chip>
                    </div>
                    <div className="grid gap-1">
                      <h2 className="truncate font-display font-semibold text-xl tracking-tight">
                        {org.name}
                      </h2>
                      <p className="flex items-center gap-3 text-muted-foreground text-sm">
                        <span>{org.planName} plan</span>
                        <span aria-hidden className="h-3 w-px bg-border" />
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon aria-hidden className="size-3.5" />
                          {org.memberCount}
                        </span>
                        <span aria-hidden className="h-3 w-px bg-border" />
                        <span>{roleLabel(org.role)}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
        <Tile className="grid scroll-mt-24 gap-6" id="new">
          <div className="grid gap-1">
            <h2 className="font-display font-semibold text-xl tracking-tight">
              New organization
            </h2>
            <p className="text-muted-foreground text-sm">
              Starts on the Free plan with up to 3 members. You can upgrade any
              time.
            </p>
          </div>
          <CreateOrgForm />
        </Tile>
      </main>
    </div>
  );
}
