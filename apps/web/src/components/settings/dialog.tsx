"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import type { ReactNode } from "react";

import { useNarrow } from "@/lib/use-narrow";

/**
 * A form step: a dialog on desktop, a bottom sheet on phones (as the
 * invoice details editor). Controlled, so the form can close it when its
 * request succeeds.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  const narrow = useNarrow();
  if (narrow) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent showCloseButton={false} side="bottom">
          <div className="grid gap-5 px-5 pt-6 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
            <SheetHeader className="gap-2 p-0">
              <SheetTitle className="font-semibold text-xl">{title}</SheetTitle>
              <SheetDescription className="text-[15px]">
                {description}
              </SheetDescription>
            </SheetHeader>
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
