"use client";

import { Toaster } from "@workspace/ui/components/sonner";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { FocusModality } from "@/components/focus-modality";
import { PressFeedback } from "@/components/press-feedback";
import { ThemeColor } from "@/components/theme-color";

export function Providers({
  children,
  nonce,
}: {
  children: ReactNode;
  /** The page's CSP nonce, for next-themes' inline script. */
  nonce?: string;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      nonce={nonce}
    >
      <TooltipProvider delay={300}>
        {children}
        <Toaster />
        <PressFeedback />
        <FocusModality />
        <ThemeColor />
      </TooltipProvider>
    </ThemeProvider>
  );
}
