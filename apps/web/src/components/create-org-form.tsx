"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function CreateOrgForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name")).trim();
    const slug = slugify(name);
    if (!slug) {
      setError("Pick a name with letters or numbers.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.organization.create({ name, slug });
    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Could not create the organization");
      return;
    }
    router.push(`/app/${slug}`);
    router.refresh();
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={onSubmit}
    >
      <div className="grid flex-1 gap-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input id="org-name" maxLength={64} name="name" required />
      </div>
      <Button disabled={pending} type="submit">
        {pending ? "Creating…" : "Create organization"}
      </Button>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
