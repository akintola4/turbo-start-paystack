import { buttonVariants } from "@workspace/ui/components/button";
import { LockIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader, Tile } from "@/components/primitives";
import { roleLabel } from "@/lib/format";
import type { BillingDeniedData } from "@/lib/view-models";

/** Billing opened by a role that can't see it: in the shell, naming who can. */
export function BillingDenied({ data }: { data: BillingDeniedData }) {
  const names = data.managers.map((m) => `${m.name} (${roleLabel(m.role)})`);
  return (
    <div className="grid animate-content gap-8">
      <PageHeader title="Billing" />
      <Tile className="flex max-w-2xl items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-surface-2 text-muted-foreground">
          <LockIcon aria-hidden className="size-5" />
        </span>
        <div className="grid justify-items-start gap-4">
          <div className="grid gap-1">
            <h2 className="font-semibold">Ask an owner about billing</h2>
            <p className="text-muted-foreground">
              Your role doesn't include the plan, card or invoices for{" "}
              {data.orgName}.{" "}
              {names.length
                ? `${new Intl.ListFormat("en-GB", { type: "disjunction" }).format(names)} can change them.`
                : "Owners and billing managers can change them."}
            </p>
          </div>
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={data.overviewHref}
          >
            Back to overview
          </Link>
        </div>
      </Tile>
    </div>
  );
}
