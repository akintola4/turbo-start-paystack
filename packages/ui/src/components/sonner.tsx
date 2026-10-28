"use client";

import {
  CircleCheckIcon,
  CircleXIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toasts on the design tokens: surface-1 with a ring (popover surface in
 * dark), radius 16, a Lucide status icon in the status colour next to the
 * words. Bottom-right on desktop, bottom-centre above the safe area on phones.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return (
    <Sonner
      className="toaster group"
      gap={8}
      icons={{
        success: <CircleCheckIcon className="size-[18px] text-success" />,
        info: <InfoIcon className="size-[18px] text-info" />,
        warning: <TriangleAlertIcon className="size-[18px] text-warning" />,
        error: <CircleXIcon className="size-[18px] text-destructive" />,
        loading: (
          <LoaderCircleIcon className="size-[18px] animate-spin text-muted-foreground motion-reduce:animate-none" />
        ),
      }}
      mobileOffset={{ bottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
      position={narrow ? "bottom-center" : "bottom-right"}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "16px",
          "--width": "380px",
        } as React.CSSProperties
      }
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      toastOptions={{
        classNames: {
          toast:
            "!font-sans !text-[15px] !gap-3 !px-4 !py-3.5 !shadow-float !border-0",
          title: "!font-semibold",
          description: "!text-muted-foreground",
          actionButton:
            "!rounded-control !bg-primary !text-primary-foreground !font-semibold",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
