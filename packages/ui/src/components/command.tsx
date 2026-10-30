"use client";

/*
 * Command: mirrors shadcn's base-vega `command` (registry/base-vega/ui/
 * command.tsx): the same exports, markup, classes and data-slots. It is
 * built on Base UI's Autocomplete rather than cmdk, because cmdk (1.1.1,
 * the latest) depends on @radix-ui/react-dialog, -id, -primitive and
 * -compose-refs, and this repo carries no Radix.
 *
 * Differences from cmdk, all from Autocomplete:
 * - The list doesn't filter itself. Pass `items` (flat or grouped) to
 *   <Command> and filter them yourself, or pass Base UI's `filter`.
 * - <CommandItem> takes `value` (the item) and `onSelect`, run on click
 *   and on Enter. Highlight (keyboard and pointer) is Base UI's
 *   `data-highlighted`, in place of cmdk's `data-selected`, on bg-accent
 *   (shadcn's bg-muted equals the popover surface in this theme's dark
 *   mode and would be invisible).
 * - <CommandGroup> takes `items` for its group when the list is grouped.
 */

import { Autocomplete } from "@base-ui/react/autocomplete";
import { cn } from "@workspace/tailwind-config/utils";
import { CheckIcon, SearchIcon } from "lucide-react";
import type * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";

type CommandProps = Omit<
  Autocomplete.Root.Props<unknown>,
  "children" | "inline" | "open"
> & {
  className?: string;
  children?: React.ReactNode;
};

function Command({ className, children, ...props }: CommandProps) {
  return (
    <Autocomplete.Root
      autoHighlight="always"
      inline
      keepHighlight
      open
      {...props}
    >
      <div
        className={cn(
          "flex size-full flex-col overflow-hidden rounded-xl! bg-popover p-1 text-popover-foreground",
          className
        )}
        data-slot="command"
      >
        {children}
      </div>
    </Autocomplete.Root>
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  finalFocus,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  showCloseButton?: boolean;
  /** Where focus goes on close (Base UI); the opener by default. */
  finalFocus?: React.ComponentProps<typeof DialogContent>["finalFocus"];
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          "top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0",
          className
        )}
        finalFocus={finalFocus}
        showCloseButton={showCloseButton}
      >
        {/* Inside the popup, so the title labels the dialog and is not left
            in the page while the palette is closed. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof Autocomplete.Input>) {
  return (
    <div className="p-1 pb-0" data-slot="command-input-wrapper">
      <Autocomplete.InputGroup
        className="relative flex h-8! w-full items-center rounded-lg! border border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!"
        data-slot="input-group"
      >
        <span
          className="flex items-center pl-2 text-muted-foreground"
          data-slot="input-group-addon"
        >
          <SearchIcon aria-hidden className="size-4 shrink-0 opacity-50" />
        </span>
        <Autocomplete.Input
          className={cn(
            "w-full bg-transparent px-2 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          data-slot="command-input"
          {...props}
        />
      </Autocomplete.InputGroup>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof Autocomplete.List>) {
  return (
    <Autocomplete.List
      className={cn(
        "no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto overscroll-contain outline-none",
        className
      )}
      data-slot="command-list"
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof Autocomplete.Empty>) {
  return (
    <Autocomplete.Empty
      className={cn("py-6 text-center text-sm empty:hidden", className)}
      data-slot="command-empty"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  heading,
  children,
  ...props
}: React.ComponentProps<typeof Autocomplete.Group> & {
  heading?: React.ReactNode;
}) {
  return (
    <Autocomplete.Group
      className={cn("overflow-hidden p-1 text-foreground", className)}
      data-slot="command-group"
      {...props}
    >
      {heading ? (
        <Autocomplete.GroupLabel
          className="px-2 py-1.5 font-medium text-muted-foreground text-xs"
          data-slot="command-group-heading"
        >
          {heading}
        </Autocomplete.GroupLabel>
      ) : null}
      {children}
    </Autocomplete.Group>
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Autocomplete.Separator>) {
  return (
    <Autocomplete.Separator
      className={cn("-mx-1 h-px w-auto bg-border", className)}
      data-slot="command-separator"
      {...props}
    />
  );
}

function CommandItem({
  className,
  children,
  onSelect,
  onClick,
  ...props
}: React.ComponentProps<typeof Autocomplete.Item> & {
  /** Runs on click and on Enter while highlighted. */
  onSelect?: () => void;
}) {
  return (
    <Autocomplete.Item
      className={cn(
        "group/command-item relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden in-data-[slot=dialog-content]:rounded-lg! data-disabled:pointer-events-none scroll-my-1 data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-highlighted:**:[svg]:text-foreground",
        className
      )}
      data-slot="command-item"
      onClick={(event) => {
        onClick?.(event);
        onSelect?.();
      }}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </Autocomplete.Item>
  );
}

function CommandShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "ml-auto text-muted-foreground text-xs tracking-widest group-data-highlighted/command-item:text-foreground",
        className
      )}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
