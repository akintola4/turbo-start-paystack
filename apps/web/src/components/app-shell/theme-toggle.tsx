"use client";

import { Button } from "@workspace/ui/components/button";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

/** Flips light/dark. Icons swap with CSS so there is no hydration flash. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      aria-label="Toggle dark mode"
      className={className}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      size="icon"
      variant="ghost"
    >
      <SunIcon className="dark:hidden" />
      <MoonIcon className="hidden dark:block" />
    </Button>
  );
}
