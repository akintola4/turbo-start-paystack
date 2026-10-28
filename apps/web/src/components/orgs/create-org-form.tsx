"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { cn } from "@workspace/tailwind-config/utils";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function CreateOrgForm({
  className,
  layout = "row",
  submitLabel = "Create organization",
}: {
  className?: string;
  layout?: "row" | "stack";
  submitLabel?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const slug = slugify(name);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug) {
      setError("Use at least one letter or number.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.organization.create({
      name: name.trim(),
      slug,
    });
    setPending(false);
    if (result.error) {
      toast.error("Couldn't create the organization", {
        description: result.error.message ?? "Try a different name.",
      });
      return;
    }
    toast.success(`${name.trim()} is ready`, {
      description: "You're the owner. Invite your team next.",
    });
    router.push(`/app/${slug}`);
    router.refresh();
  }

  return (
    <form className={cn("grid gap-3", className)} onSubmit={onSubmit}>
      <div
        className={cn(
          "grid gap-3",
          layout === "row" && "sm:grid-cols-[1fr_auto] sm:items-end"
        )}
      >
        <div className="grid gap-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            aria-describedby="org-slug"
            id="org-name"
            maxLength={64}
            name="name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Logistics"
            required
            value={name}
          />
        </div>
        <Button disabled={pending} type="submit">
          {pending ? (
            <Loader2Icon aria-hidden className="animate-spin" />
          ) : null}
          {submitLabel}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs" id="org-slug">
        {slug ? (
          <>
            Address:{" "}
            <span className="font-mono text-foreground">/app/{slug}</span>
          </>
        ) : (
          "Billing, members and roles belong to the organization."
        )}
      </p>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
