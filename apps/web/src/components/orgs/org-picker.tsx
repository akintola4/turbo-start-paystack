import { cn } from "@workspace/tailwind-config/utils";
import { Button } from "@workspace/ui/components/button";

import { CONTENT, TopBarRow } from "@/components/app-shell/top-bar";
import { UserMenu } from "@/components/app-shell/user-menu";
import { MarkAvatar } from "@/components/mark-avatar";
import { NewOrgDialog } from "@/components/orgs/new-org-dialog";
import { OrgCollection } from "@/components/orgs/org-collection";
import { VerifyCallout } from "@/components/orgs/verify-callout";
import { PageHeader, Tile, Wordmark } from "@/components/primitives";
import type { OrgPickerData } from "@/lib/view-models";

export function OrgPicker({ data }: { data: OrgPickerData }) {
  const first = data.user.name.split(" ")[0] ?? data.user.name;
  return (
    <div className="min-h-dvh bg-background">
      <TopBarRow className="justify-between gap-4">
        <Wordmark href="/app" />
        <UserMenu align="end" contentClassName="w-60" user={data.user}>
          <Button
            aria-label="Account menu"
            className="-mr-2 gap-2 pr-3 pl-1.5"
            variant="ghost"
          >
            <MarkAvatar seed={data.user.email} />
            <span className="hidden text-sm sm:inline">{first}</span>
          </Button>
        </UserMenu>
      </TopBarRow>
      <main className={cn(CONTENT, "grid gap-8")} id="content">
        <PageHeader
          actions={<NewOrgDialog defaultOpen={data.orgs.length === 0} />}
          title="Organizations"
        />
        {data.user.emailVerified ? null : (
          <VerifyCallout email={data.user.email} />
        )}
        {data.orgs.length ? (
          <OrgCollection initialView={data.view} orgs={data.orgs} />
        ) : (
          <Tile className="grid justify-items-start gap-2">
            <p className="font-semibold">No organizations yet</p>
            <p className="text-muted-foreground">
              Create one for your team, or open an invitation link someone sent
              you.
            </p>
          </Tile>
        )}
      </main>
    </div>
  );
}
