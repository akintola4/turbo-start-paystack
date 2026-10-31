import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";
import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { CommandPaletteProvider } from "@/components/app-shell/command-palette";
import { RememberOrg } from "@/components/app-shell/remember-org";
import { SiteHeader } from "@/components/app-shell/site-header";
import { CONTENT } from "@/components/app-shell/top-bar";
import type { ShellData } from "@/lib/view-models";

/**
 * shadcn's sidebar-07 layout with the inset variant: SidebarProvider at the
 * root (its open state in the `sidebar_state` cookie, read on the server),
 * the sidebar, and SidebarInset, a bordered card on the sidebar's colour
 * holding the header and the centred page column. On desktop the card is
 * the scroller, so the sticky header stays inside its rounded top; phones
 * scroll the page as before.
 */
export function AppShell({
  data,
  sidebarOpen,
  children,
}: {
  data: ShellData;
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarProvider
      className="bg-sidebar md:h-svh md:overflow-hidden"
      defaultOpen={sidebarOpen}
    >
      <CommandPaletteProvider org={data.org} role={data.role}>
        <AppSidebar data={data} />
        <RememberOrg slug={data.org.slug} />
        <SidebarInset
          className="min-w-0 bg-background md:h-[calc(100svh-1rem)] md:overflow-y-auto md:ring-1 md:ring-sidebar-border md:[scrollbar-color:transparent_transparent] md:[scrollbar-gutter:stable]"
          data-scroller
        >
          <SiteHeader org={data.org} />
          <main className={CONTENT} id="content">
            {children}
          </main>
        </SidebarInset>
      </CommandPaletteProvider>
    </SidebarProvider>
  );
}
