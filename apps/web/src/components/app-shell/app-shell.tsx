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
 * shadcn's sidebar-07 layout: SidebarProvider at the root (its open state
 * in the `sidebar_state` cookie, read on the server), the sidebar, and
 * SidebarInset with the header and the centred page column.
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
    <SidebarProvider className="bg-background" defaultOpen={sidebarOpen}>
      <CommandPaletteProvider org={data.org} role={data.role}>
        <AppSidebar data={data} />
        <RememberOrg slug={data.org.slug} />
        <SidebarInset className="min-w-0 bg-background">
          <SiteHeader org={data.org} />
          <main className={CONTENT} id="content">
            {children}
          </main>
        </SidebarInset>
      </CommandPaletteProvider>
    </SidebarProvider>
  );
}
