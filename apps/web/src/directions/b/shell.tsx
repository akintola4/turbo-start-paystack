"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@workspace/ui/components/command";
import { Separator } from "@workspace/ui/components/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar";
import { cn } from "@workspace/tailwind-config/utils";
import {
  ChevronsUpDownIcon,
  CreditCardIcon,
  LayoutGridIcon,
  LogOutIcon,
  MoonIcon,
  SearchIcon,
  SquareTerminalIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { Monogram } from "@/components/shared/avatars";
import { OrgSwitcherMenu } from "@/components/shared/org-switcher-menu";
import { UserMenu, useSignOut } from "@/components/shared/user-menu";
import type { ShellData } from "@/directions/types";
import { roleLabel, STATUS_META } from "@/lib/format";
import { Kbd, Mark, Pill } from "./primitives";

type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: typeof LayoutGridIcon;
  shortcut: string;
};

function navItems(data: ShellData): NavItem[] {
  const items: NavItem[] = [
    {
      key: "overview",
      label: "Overview",
      href: data.nav.overview,
      icon: SquareTerminalIcon,
      shortcut: "O",
    },
    {
      key: "members",
      label: "Members",
      href: data.nav.members,
      icon: UsersIcon,
      shortcut: "M",
    },
  ];
  if (data.nav.billing) {
    items.push({
      key: "billing",
      label: "Billing",
      href: data.nav.billing,
      icon: CreditCardIcon,
      shortcut: "B",
    });
  }
  return items;
}

function activeKey(pathname: string, data: ShellData) {
  if (data.nav.billing && pathname.startsWith(data.nav.billing)) {
    return "billing";
  }
  if (pathname.startsWith(data.nav.members)) {
    return "members";
  }
  return "overview";
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(
    el &&
      (el.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) ||
        el.closest("[role=dialog]"))
  );
}

/** ⌘K palette plus "g then o/m/b" navigation. */
function useShortcuts(
  items: NavItem[],
  setOpen: (fn: (o: boolean) => boolean) => void
) {
  const router = useRouter();
  const pendingG = useRef<number | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) {
        return;
      }
      const key = e.key.toLowerCase();
      if (pendingG.current && Date.now() - pendingG.current < 900) {
        const item = items.find((i) => i.shortcut.toLowerCase() === key);
        pendingG.current = null;
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (key === "g") {
        pendingG.current = Date.now();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, router, setOpen]);
}

function CommandPalette({
  data,
  items,
  open,
  setOpen,
}: {
  data: ShellData;
  items: NavItem[];
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const signOut = useSignOut();
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  return (
    <CommandDialog
      className="top-[18%] translate-y-0 sm:max-w-[560px] [&_[cmdk-item]]:py-2 [&_[cmdk-item]_svg]:size-4"
      description="Jump to a page, switch organization or run an action."
      onOpenChange={setOpen}
      open={open}
      showCloseButton={false}
      title="Command menu"
    >
      <CommandInput placeholder="Type a command or search" />
      <CommandList className="max-h-[360px]">
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {items.map((item) => (
            <CommandItem
              key={item.key}
              onSelect={() => go(item.href)}
              value={`go ${item.label}`}
            >
              <item.icon />
              {item.label}
              <CommandShortcut className="flex gap-1">
                <Kbd>G</Kbd>
                <Kbd>{item.shortcut}</Kbd>
              </CommandShortcut>
            </CommandItem>
          ))}
          <CommandItem onSelect={() => go("/app")} value="go all organizations">
            <LayoutGridIcon />
            All organizations
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Organizations">
          {data.orgs.map((org) => (
            <CommandItem
              key={org.id}
              onSelect={() => go(`/app/${org.slug}`)}
              value={`switch ${org.name} ${org.slug}`}
            >
              <Monogram
                className="size-5 text-[9px]"
                name={org.name}
                seed={org.slug}
                tone="mono"
              />
              {org.name}
              {org.slug === data.org.slug ? (
                <CommandShortcut>Current</CommandShortcut>
              ) : (
                <CommandShortcut>{roleLabel(org.role)}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => go(`${data.nav.members}?invite=1`)}
            value="invite member teammate"
          >
            <UserPlusIcon />
            Invite member
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
            value="toggle theme dark light"
          >
            <MoonIcon />
            Toggle theme
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setOpen(false);
              signOut();
            }}
            value="sign out log out"
          >
            <LogOutIcon />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function ConsoleShell({
  data,
  children,
}: {
  data: ShellData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const items = navItems(data);
  const current = activeKey(pathname, data);
  const [open, setOpen] = useState(false);
  useShortcuts(items, setOpen);
  const status = STATUS_META[data.plan.status ?? "free"];
  const page = items.find((i) => i.key === current)?.label ?? "Overview";

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "15rem",
          "--sidebar-width-icon": "3rem",
        } as CSSProperties
      }
    >
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-12 justify-center border-b px-2 py-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <OrgSwitcherMenu
                current={data.org.slug}
                monogramTone="mono"
                orgs={data.orgs}
              >
                <SidebarMenuButton
                  aria-label={`Organization: ${data.org.name}. Switch organization`}
                  className="h-8 gap-2 px-1.5 data-[state=open]:bg-sidebar-accent"
                >
                  <Monogram
                    className="size-5 rounded bg-foreground text-[9px] text-background"
                    name={data.org.name}
                    seed={data.org.slug}
                    tone="mono"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-[13px] text-sidebar-accent-foreground">
                    {data.org.name}
                  </span>
                  <ChevronsUpDownIcon className="ml-auto size-3.5 opacity-50" />
                </SidebarMenuButton>
              </OrgSwitcherMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="pt-3">
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    className="text-[13px] text-muted-foreground"
                    onClick={() => setOpen(true)}
                    tooltip="Search  ⌘K"
                  >
                    <SearchIcon />
                    <span>Search</span>
                    <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">
                      ⌘K
                    </Kbd>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="pt-0">
            <SidebarGroupLabel className="h-7 text-[11.5px]">
              Workspace
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {items.map((item) => (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      className="text-[13px]"
                      isActive={current === item.key}
                      tooltip={item.label}
                    >
                      <Link
                        aria-current={current === item.key ? "page" : undefined}
                        href={item.href}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover/menu-item:opacity-100 group-data-[collapsible=icon]:hidden">
                          <Kbd>G</Kbd>
                          <Kbd>{item.shortcut}</Kbd>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="mt-auto group-data-[collapsible=icon]:hidden">
            <div className="grid gap-1.5 rounded-md border px-3 py-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Plan</span>
                <span className="font-medium text-sidebar-accent-foreground">
                  {data.plan.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Pill
                  className="h-[18px] border-transparent px-0 text-[11.5px]"
                  tone={status.tone}
                >
                  {status.label}
                </Pill>
              </div>
            </div>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <UserMenu side="top" user={data.user}>
                <SidebarMenuButton
                  aria-label={`Account: ${data.user.name}`}
                  className="h-10 gap-2 px-1.5 data-[state=open]:bg-sidebar-accent"
                >
                  <Monogram
                    className="size-6 text-[10px]"
                    name={data.user.name}
                    seed={data.user.email}
                    shape="circle"
                    tone="mono"
                  />
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate font-medium text-[13px] text-sidebar-accent-foreground">
                      {data.user.name}
                    </span>
                    <span className="truncate text-[11.5px] text-muted-foreground">
                      {roleLabel(data.role)}
                    </span>
                  </span>
                  <ChevronsUpDownIcon className="ml-auto size-3.5 opacity-50" />
                </SidebarMenuButton>
              </UserMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur-md md:px-8">
          <SidebarTrigger
            aria-label="Toggle sidebar"
            className="-ml-2 size-8 text-muted-foreground"
          />
          <Separator
            className="mr-1 data-[orientation=vertical]:h-4"
            orientation="vertical"
          />
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
              <li className="hidden min-w-0 sm:block">
                <Link
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  href={data.nav.overview}
                >
                  {data.org.name}
                </Link>
              </li>
              <li
                aria-hidden
                className="hidden text-muted-foreground/50 sm:block"
              >
                /
              </li>
              <li aria-current="page" className="truncate font-medium">
                {page}
              </li>
            </ol>
          </nav>
          <button
            className={cn(
              "flex h-8 items-center gap-2 rounded-md border bg-muted/40 px-2.5 text-[13px] text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
              "w-8 justify-center px-0 sm:w-56 sm:justify-start sm:px-2.5"
            )}
            onClick={() => setOpen(true)}
            type="button"
          >
            <SearchIcon aria-hidden className="size-4 shrink-0" />
            <span className="hidden sm:inline">Search or jump to</span>
            <span className="sr-only sm:hidden">Open command menu</span>
            <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
          </button>
        </header>
        <div className="w-full max-w-[1280px] px-4 pt-8 pb-28 md:px-8">
          {children}
        </div>
      </SidebarInset>
      <CommandPalette data={data} items={items} open={open} setOpen={setOpen} />
    </SidebarProvider>
  );
}

export function ConsoleMarkLink() {
  return (
    <Link aria-label="Home" className="inline-flex" href="/">
      <Mark />
    </Link>
  );
}
