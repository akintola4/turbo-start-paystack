import { isCurrency } from "@workspace/billing/money";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { NotFoundPage } from "@/components/not-found/not-found-page";

export const metadata: Metadata = {
  title: "Page not found",
  description: "There is no page at this address.",
  robots: { index: false },
};

/**
 * Every unknown URL (and every `notFound()`) lands here with a 404. The
 * remembered currency comes from the landing's cookie, so the tiles and the
 * receipt speak the visitor's money from the first paint.
 */
export default async function NotFound() {
  const saved = (await cookies()).get("tsp-currency")?.value ?? "";
  return <NotFoundPage currency={isCurrency(saved) ? saved : "NGN"} />;
}
