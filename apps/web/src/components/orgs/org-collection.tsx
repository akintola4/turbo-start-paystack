"use client";

import { Input } from "@workspace/ui/components/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import { cn } from "@workspace/tailwind-config/utils";
import {
  ChevronRightIcon,
  LayoutGridIcon,
  ListIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AnimatedNumber } from "@/components/animated-number";
import { Monogram } from "@/components/avatars";
import { RowPresenceProvider, useRowPresence } from "@/components/motion";
import { Amount, StatusBadge } from "@/components/primitives";
import { formatDate, roleLabel } from "@/lib/format";
import { ORG_VIEW_COOKIE } from "@/lib/org-view";
import type { OrgPickerData } from "@/lib/view-models";

type Org = OrgPickerData["orgs"][number];
type View = OrgPickerData["view"];

function statusLabel(org: Org) {
  if (org.status === "trialing" && org.billing?.date) {
    return `Trial (ends ${formatDate(org.billing.date, "short")})`;
  }
  if (org.billing?.kind === "ends") {
    return "Cancelling";
  }
  return undefined;
}

function BillingLine({ org }: { org: Org }) {
  const b = org.billing;
  if (!b) {
    return <span className="text-muted-foreground">—</span>;
  }
  const when = formatDate(b.date, "short");
  if (b.kind === "grace") {
    return <span className="text-warning">Fix by {when}</span>;
  }
  if (b.kind === "ends") {
    return <span className="text-muted-foreground">Ends {when}</span>;
  }
  return (
    <span>
      <Amount label={b.priceLabel} />{" "}
      <span className="text-muted-foreground">on {when}</span>
    </span>
  );
}

function Members({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <UsersIcon aria-hidden className="size-4" />
      <AnimatedNumber
        label={`${count} ${count === 1 ? "member" : "members"}`}
        value={count}
      />
    </span>
  );
}

/** One row: avatar, name/plan, status, members, role, billing, chevron. */
function OrgRow({ org }: { org: Org }) {
  return (
    <li data-presence={useRowPresence(org.id)}>
      <Link
        className="grid min-h-16 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-[background-color] duration-(--dur-fast) hover:bg-surface-2 active:bg-surface-3 sm:px-5 md:grid-cols-[2.5rem_minmax(0,1fr)_11.5rem_4.5rem_5.5rem_12rem_1.25rem] md:gap-x-4"
        href={`/app/${org.slug}`}
      >
        <Monogram
          className="row-span-2 size-10 rounded-control text-[13px] md:row-span-1"
          name={org.name}
          tone="solid"
        />
        <span className="grid min-w-0 gap-0.5">
          <span className="truncate font-semibold">{org.name}</span>
          <span className="truncate text-muted-foreground text-sm">
            {org.planName} plan
          </span>
        </span>
        <span className="justify-self-end md:justify-self-start">
          <StatusBadge label={statusLabel(org)} status={org.status ?? "free"} />
        </span>
        {/* Rendered once; on phones they share the second line under the name. */}
        <span className="col-start-2 row-start-2 text-sm md:col-start-auto md:row-start-auto">
          <Members count={org.memberCount} />
        </span>
        <span className="col-start-3 row-start-2 justify-self-end text-muted-foreground text-sm md:col-start-auto md:row-start-auto md:justify-self-start">
          {roleLabel(org.role)}
        </span>
        <span className="hidden text-right text-sm tabular-nums md:block">
          <BillingLine org={org} />
        </span>
        <ChevronRightIcon
          aria-hidden
          className="hidden size-5 text-muted-foreground md:block"
        />
      </Link>
    </li>
  );
}

function OrgCard({ org }: { org: Org }) {
  return (
    <li data-presence={useRowPresence(org.id)}>
      <Link
        className="grid h-full content-between gap-6 rounded-tile bg-card p-5 shadow-tile transition-[background-color,scale] duration-(--dur-fast) ease-out hover:bg-surface-2 active:scale-[0.985]"
        href={`/app/${org.slug}`}
      >
        <div className="flex items-start justify-between gap-3">
          <Monogram
            className="size-10 rounded-control text-[13px]"
            name={org.name}
            tone="solid"
          />
          <StatusBadge label={statusLabel(org)} status={org.status ?? "free"} />
        </div>
        <div className="grid gap-1">
          <span className="truncate font-semibold text-lg">{org.name}</span>
          <span className="text-muted-foreground text-sm">
            {org.planName} plan
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 border-border border-t pt-4 text-sm">
          <span className="flex items-center gap-3">
            <Members count={org.memberCount} />
            <span className="text-muted-foreground">{roleLabel(org.role)}</span>
          </span>
          <span className="tabular-nums">
            <BillingLine org={org} />
          </span>
        </div>
      </Link>
    </li>
  );
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: View;
  onChange: (view: View) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Layout"
      className="rounded-control bg-surface-3 p-1 dark:bg-surface-1 dark:shadow-tile"
      onValueChange={(v) => {
        const next = v[0];
        if (next === "list" || next === "grid") {
          onChange(next);
        }
      }}
      value={[value]}
    >
      <ToggleGroupItem
        aria-label="List view"
        className="size-9 rounded-chip data-[pressed]:bg-surface-1 data-[pressed]:shadow-tile dark:data-[pressed]:bg-surface-3"
        value="list"
      >
        <ListIcon aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem
        aria-label="Grid view"
        className="size-9 rounded-chip data-[pressed]:bg-surface-1 data-[pressed]:shadow-tile dark:data-[pressed]:bg-surface-3"
        value="grid"
      >
        <LayoutGridIcon aria-hidden />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * Org list (default) or grid. The layout choice lives in a cookie so the
 * server renders it on the first paint; search appears past 8 orgs.
 */
export function OrgCollection({
  orgs,
  initialView,
}: {
  orgs: Org[];
  initialView: View;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const shown = query
    ? orgs.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))
    : orgs;

  return (
    <section aria-labelledby="orgs-title" className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold text-xl" id="orgs-title">
          Your organizations
        </h2>
        <span className="text-muted-foreground tabular-nums">
          <AnimatedNumber value={orgs.length} />
        </span>
        <div className="ml-auto flex items-center gap-2">
          {orgs.length > 8 ? (
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground"
              />
              <Input
                aria-label="Search organizations"
                className="h-11 w-56 pl-9"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                type="search"
                value={query}
              />
            </div>
          ) : null}
          <ViewToggle
            onChange={(next) => {
              setView(next);
              // biome-ignore lint/suspicious/noDocumentCookie: one non-sensitive UI preference, read on the server for SSR.
              document.cookie = `${ORG_VIEW_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
              router.refresh();
            }}
            value={view}
          />
        </div>
      </div>
      <RowPresenceProvider ids={orgs.map((o) => o.id)}>
        {view === "list" ? (
          <ul className="divide-y divide-border overflow-hidden rounded-card bg-card shadow-tile">
            {shown.map((org) => (
              <OrgRow key={org.id} org={org} />
            ))}
          </ul>
        ) : (
          <ul
            className={cn(
              "grid gap-4",
              shown.length === 1
                ? "sm:grid-cols-[minmax(0,26rem)]"
                : "grid-cols-[repeat(auto-fill,minmax(18rem,1fr))]"
            )}
          >
            {shown.map((org) => (
              <OrgCard key={org.id} org={org} />
            ))}
          </ul>
        )}
      </RowPresenceProvider>
      {shown.length === 0 ? (
        <p className="text-muted-foreground">
          No organizations match “{query}”.
        </p>
      ) : null}
    </section>
  );
}
