import { Button } from "@workspace/ui/components/button";

import { Monogram } from "@/components/avatars";
import { NewOrgDialog } from "@/components/orgs/new-org-dialog";
import { OrgCollection } from "@/components/orgs/org-collection";
import { VerifyCallout } from "@/components/orgs/verify-callout";
import { UserMenu } from "@/components/app-shell/user-menu";
import type { OrgPickerData } from "@/lib/view-models";
import { PageHeader, Tile, Wordmark } from "@/components/primitives";

export function OrgPicker({ data }: { data: OrgPickerData }) {
  const first = data.user.name.split(" ")[0] ?? data.user.name;
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-4 pt-[env(safe-area-inset-top)] sm:h-20 sm:px-8">
        <Wordmark href="/app" />
        <UserMenu align="end" contentClassName="w-60" user={data.user}>
          <Button
            aria-label="Account menu"
            className="-mr-2 gap-2 pr-3 pl-1.5"
            variant="ghost"
          >
            <Monogram className="size-8" name={data.user.name} shape="circle" />
            <span className="hidden text-sm sm:inline">{first}</span>
          </Button>
        </UserMenu>
      </header>
      <main
        className="mx-auto grid max-w-[1120px] gap-8 px-4 pt-6 pb-24 sm:px-8 sm:pt-10"
        id="content"
      >
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
