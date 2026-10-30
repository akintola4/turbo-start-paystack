"use client";

import { Toaster } from "@workspace/ui/components/sonner";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { FocusModality } from "@/components/focus-modality";
import { PressFeedback } from "@/components/press-feedback";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
    >
      <TooltipProvider delay={300}>
        {children}
        <Toaster />
        <PressFeedback />
        <FocusModality />
      </TooltipProvider>
    </ThemeProvider>
  );
}
