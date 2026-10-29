"use client";

import { Button } from "@workspace/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";

/**
 * A server error inside an organization. Next logs it on the server with
 * the same digest shown here, so a support request can be matched to it.
 */
export default function OrgError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="mx-auto grid max-w-md justify-items-start gap-4 py-24"
      role="alert"
    >
      <TriangleAlertIcon aria-hidden className="size-5 text-warning" />
      <div className="grid gap-1">
        <h1 className="font-display font-semibold text-lg">
          This page didn't load
        </h1>
        <p className="text-muted-foreground text-sm">
          Something went wrong on our side. Try again in a moment.
          {error.digest ? (
            <>
              {" "}
              If it keeps happening, quote reference{" "}
              <code className="font-mono text-foreground">{error.digest}</code>.
            </>
          ) : null}
        </p>
      </div>
      <Button onClick={reset} size="sm" variant="outline">
        Try again
      </Button>
    </div>
  );
}
