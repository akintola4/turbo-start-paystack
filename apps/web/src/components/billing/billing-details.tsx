"use client";

import { Button } from "@workspace/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Tile } from "@/components/primitives";
import { toast } from "@/lib/toast";
import { useNarrow } from "@/lib/use-narrow";
import type { BillingDetailsData } from "@/lib/view-models";

const TITLE = "Invoice details";
const DESCRIPTION =
  "Who new invoices are made out to. Invoices already issued keep the details they were issued with.";

type Fields = {
  legalName: string;
  address: string;
  taxId: string;
  email: string;
};

function DetailsForm({
  orgId,
  details,
  onSaved,
}: {
  orgId: string;
  details: BillingDetailsData;
  onSaved: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({
    legalName: details.legalName ?? "",
    address: details.address ?? "",
    taxId: details.taxId ?? "",
    email: details.email ?? "",
  });
  const set = (key: keyof Fields) => (value: string) =>
    setFields((f) => ({ ...f, [key]: value }));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/billing/billing-details`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    }).catch(() => null);
    setPending(false);
    if (!res?.ok) {
      const message =
        res?.status === 400
          ? "Check the billing email: it must be a full address, like accounts@company.com."
          : "Your changes weren't saved. Try again in a moment.";
      setError(message);
      toast.error("Couldn't save invoice details", { description: message });
      return;
    }
    toast.success("Invoice details saved", {
      description: "New invoices use them. Issued invoices are unchanged.",
    });
    onSaved();
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="bd-name">Legal name</Label>
        <Input
          autoComplete="organization"
          id="bd-name"
          maxLength={200}
          onChange={(e) => set("legalName")(e.target.value)}
          placeholder={details.fallback.name}
          value={fields.legalName}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="bd-address">Address</Label>
        <textarea
          autoComplete="street-address"
          className="min-h-24 w-full rounded-control border border-input bg-surface-1 px-3.5 py-2.5 text-base outline-none transition-[border-color] duration-(--dur-fast) placeholder:text-subtle-foreground focus-visible:border-ring md:text-sm"
          id="bd-address"
          maxLength={500}
          onChange={(e) => set("address")(e.target.value)}
          placeholder={"3 Marina\nLagos Island, Lagos"}
          rows={3}
          value={fields.address}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="bd-tax">Tax ID</Label>
          <Input
            id="bd-tax"
            maxLength={64}
            onChange={(e) => set("taxId")(e.target.value)}
            placeholder="TIN or RC number"
            value={fields.taxId}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bd-email">Billing email</Label>
          <Input
            aria-describedby={error ? "bd-error" : undefined}
            aria-invalid={error ? true : undefined}
            autoCapitalize="none"
            autoComplete="email"
            id="bd-email"
            inputMode="email"
            maxLength={254}
            onChange={(e) => set("email")(e.target.value)}
            placeholder={details.fallback.email ?? "accounts@company.com"}
            type="email"
            value={fields.email}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Leave a field blank to use the organization name and the email Paystack
        bills.
      </p>
      {error ? (
        <p className="text-destructive text-sm" id="bd-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button className="justify-self-start" pending={pending} type="submit">
        Save details
      </Button>
    </form>
  );
}

function Summary({ details }: { details: BillingDetailsData }) {
  const name = details.legalName ?? details.fallback.name;
  const email = details.email ?? details.fallback.email;
  const rest = [
    details.address?.replaceAll("\n", ", "),
    details.taxId ? `Tax ID ${details.taxId}` : null,
    email,
  ].filter(Boolean);
  return (
    <div className="grid min-w-0 gap-0.5">
      <p className="truncate font-semibold">{name}</p>
      <p className="truncate text-muted-foreground text-sm">
        {rest.length > 0 ? rest.join(" · ") : "No address or tax ID yet"}
      </p>
    </div>
  );
}

/** "Invoices are made out to …", with an Edit dialog for billing managers. */
export function BillingDetails({
  orgId,
  details,
  canManage,
}: {
  orgId: string;
  details: BillingDetailsData;
  canManage: boolean;
}) {
  const narrow = useNarrow();
  const [open, setOpen] = useState(false);
  const trigger = (
    <Button size="sm" variant="outline">
      <PencilIcon aria-hidden />
      Edit
    </Button>
  );
  const form = (
    <DetailsForm
      details={details}
      onSaved={() => setOpen(false)}
      orgId={orgId}
    />
  );
  let editor: React.ReactNode = null;
  if (canManage) {
    editor = narrow ? (
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger render={trigger} />
        <SheetContent showCloseButton={false} side="bottom">
          <div className="grid gap-5 px-5 pt-6 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
            <SheetHeader className="gap-2 p-0">
              <SheetTitle>{TITLE}</SheetTitle>
              <SheetDescription className="text-[15px]">
                {DESCRIPTION}
              </SheetDescription>
            </SheetHeader>
            {form}
          </div>
        </SheetContent>
      </Sheet>
    ) : (
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogTrigger render={trigger} />
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{TITLE}</DialogTitle>
            <DialogDescription>{DESCRIPTION}</DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Tile
      aria-labelledby="invoice-details-title"
      className="flex items-center justify-between gap-4 py-4 sm:py-4"
    >
      <div className="grid min-w-0 gap-1">
        <h3
          className="font-medium text-[13px] text-muted-foreground"
          id="invoice-details-title"
        >
          Invoices are made out to
        </h3>
        <Summary details={details} />
      </div>
      {editor}
    </Tile>
  );
}
