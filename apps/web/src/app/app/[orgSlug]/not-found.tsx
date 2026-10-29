"use client";

import { buttonVariants } from "@workspace/ui/components/button";
import Link from "next/link";
import { useParams } from "next/navigation";

/**
 * A missing page inside an organization (an unknown id, or one the member's
 * role can't open). It renders inside the app shell, so it stays small and
 * points back to the organization's dashboard. The mark is the logo's 2 x 2
 * tiles with the last one missing.
 */
export default function OrgNotFound() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return (
    <div className="mx-auto grid max-w-md justify-items-start gap-4 py-24">
      <svg aria-hidden className="size-7" fill="none" viewBox="0 0 28 28">
        <rect fill="var(--panel)" height="28" rx="8" width="28" />
        <rect fill="var(--highlight)" height="9" rx="3" width="9" x="4" y="4" />
        <rect
          fill="var(--panel-tile)"
          height="9"
          rx="3"
          width="9"
          x="15"
          y="4"
        />
        <rect
          fill="var(--panel-tile)"
          height="9"
          rx="3"
          width="9"
          x="4"
          y="15"
        />
      </svg>
      <div className="grid gap-1">
        <h1 className="font-display font-semibold text-lg">
          This page isn’t in this organization
        </h1>
        <p className="text-muted-foreground text-sm">
          It may have moved, or your role can’t open it. Ask an owner if you
          need access.
        </p>
      </div>
      <Link
        className={buttonVariants({ size: "sm", variant: "outline" })}
        href={`/app/${orgSlug}`}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
