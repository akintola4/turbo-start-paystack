"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import { Button } from "@workspace/ui/components/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet";
import type { ReactNode } from "react";

import { useNarrow } from "@/lib/use-narrow";

export type ConfirmProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
};

/**
 * Confirmation step: an alert dialog on desktop, a bottom sheet on phones.
 * The confirm button closes it before running the action.
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmProps) {
  const narrow = useNarrow();
  const confirm = () => {
    onOpenChange(false);
    onConfirm();
  };
  if (narrow) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent showCloseButton={false} side="bottom">
          <SheetHeader className="gap-2 px-5 pt-6">
            <SheetTitle className="font-semibold text-xl">{title}</SheetTitle>
            <SheetDescription className="text-[15px]">
              {description}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="grid gap-2 px-5">
            <Button
              onClick={confirm}
              variant={destructive ? "destructive" : "default"}
            >
              {confirmLabel}
            </Button>
            <SheetClose render={<Button variant="outline" />}>
              {cancelLabel}
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirm}
            variant={destructive ? "destructive" : "default"}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
