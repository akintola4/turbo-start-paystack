"use client";

import { Button } from "@workspace/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";

export default function OrgError({
  reset,
}: {
  error: Error;
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
          The server returned an error. Try again; if it keeps happening, check
          the server logs.
        </p>
      </div>
      <Button onClick={reset} size="sm" variant="outline">
        Try again
      </Button>
    </div>
  );
}
