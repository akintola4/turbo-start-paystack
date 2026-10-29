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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { CreateOrgForm } from "@/components/orgs/create-org-form";
import { useNarrow } from "@/lib/use-narrow";

const TITLE = "New organization";
const DESCRIPTION =
  "Members, roles and billing belong to an organization. You'll be its owner.";

/** Compact "New organization" button; the form opens in a dialog or sheet. */
export function NewOrgDialog({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const narrow = useNarrow();
  const [open, setOpen] = useState(defaultOpen);
  // `/app#new` (from the org switcher) opens it straight away.
  useEffect(() => {
    if (window.location.hash === "#new") {
      setOpen(true);
    }
  }, []);
  const trigger = (
    <Button>
      <PlusIcon aria-hidden />
      New organization
    </Button>
  );
  if (narrow) {
    return (
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger render={trigger} />
        <SheetContent showCloseButton={false} side="bottom">
          <div className="grid gap-5 px-5 pt-6">
            <SheetHeader className="gap-2 p-0">
              <SheetTitle>{TITLE}</SheetTitle>
              <SheetDescription className="text-[15px]">
                {DESCRIPTION}
              </SheetDescription>
            </SheetHeader>
            <CreateOrgForm layout="stack" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <CreateOrgForm layout="stack" />
      </DialogContent>
    </Dialog>
  );
}
