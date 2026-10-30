"use client";

import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";

import { FormAlert, inlineLinkClass } from "@/components/auth/auth-form";
import { authClient } from "@/lib/auth-client";
import { slugInput, slugify } from "@/lib/org-settings";
import { toast } from "@/lib/toast";

/**
 * Name → address. The address follows the name until someone edits it;
 * a taken address is said under its field, which opens for editing.
 */
export function CreateOrgForm({ footer }: { footer?: ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState<{ message: string; slug: boolean } | null>(
    null
  );
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  // Typing keeps a trailing hyphen so "kola-ng" can be typed; it's
  // trimmed here.
  const slug = slugify(customSlug ?? name);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slug) {
      setError({ message: "Use at least one letter or number.", slug: false });
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.organization.create({
      name: name.trim(),
      slug,
    });
    if (result.error) {
      setPending(false);
      const taken = /slug|exists|taken/i.test(
        `${result.error.code ?? ""} ${result.error.message ?? ""}`
      );
      if (taken) {
        setCustomSlug(slug);
        setError({
          message: `/app/${slug} is taken. Pick another address.`,
          slug: true,
        });
        return;
      }
      setError({
        message: result.error.message ?? "Couldn't create the organization.",
        slug: false,
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
    <form className="grid gap-5" onSubmit={onSubmit}>
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
        {customSlug === null ? (
          <p className="text-muted-foreground text-sm" id="org-slug">
            {slug ? (
              <>
                Address:{" "}
                <span className="font-mono text-foreground">/app/{slug}</span>{" "}
                <button
                  className={inlineLinkClass}
                  onClick={() => setCustomSlug(slug)}
                  type="button"
                >
                  Edit
                </button>
              </>
            ) : (
              "The address comes from the name."
            )}
          </p>
        ) : null}
      </div>
      {customSlug === null ? null : (
        <div className="grid gap-2">
          <Label htmlFor="org-slug-input">Address</Label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground text-sm">
              /app/
            </span>
            <Input
              aria-describedby={error?.slug ? "org-error" : undefined}
              aria-invalid={error?.slug || undefined}
              autoCapitalize="none"
              autoComplete="off"
              className="font-mono"
              id="org-slug-input"
              onChange={(e) => {
                setCustomSlug(slugInput(e.target.value));
                if (error?.slug) {
                  setError(null);
                }
              }}
              spellCheck={false}
              value={customSlug}
            />
          </div>
        </div>
      )}
      {error ? (
        <div id="org-error">
          <FormAlert>{error.message}</FormAlert>
        </div>
      ) : null}
      <Button pending={pending} type="submit">
        Create organization
      </Button>
      {footer}
    </form>
  );
}
