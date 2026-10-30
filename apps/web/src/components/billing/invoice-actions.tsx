"use client";

import { Button, buttonVariants } from "@workspace/ui/components/button";
import { DownloadIcon, PrinterIcon } from "lucide-react";

/** Download (the server-rendered PDF) and Print (this page, A4 rules). */
export function InvoiceActions({
  pdfHref,
  filename,
}: {
  pdfHref: string;
  filename: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-print="hide">
      <Button onClick={() => window.print()} variant="outline">
        <PrinterIcon aria-hidden />
        Print
      </Button>
      <a className={buttonVariants()} download={filename} href={pdfHref}>
        <DownloadIcon aria-hidden />
        Download PDF
      </a>
    </div>
  );
}
