import { isCurrency } from "@workspace/billing/money";
import { env } from "@workspace/env/client";
import { cookies } from "next/headers";

import { Landing } from "@/components/landing/landing";
import { landingJsonLd, serializeJsonLd } from "@/lib/json-ld";

/**
 * Reads the remembered currency so the server renders prices, the receipt
 * and the footer tile in it: no flash of naira for a visitor who chose rand.
 * `?currency=` and `?interval=` come from the wall and the interval switch
 * when JavaScript is off (they submit as GET forms), and win over the cookie.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string; interval?: string }>;
}) {
  const query = await searchParams;
  const saved = (await cookies()).get("tsp-currency")?.value ?? "";
  const asked = query.currency ?? "";
  const currency = isCurrency(asked)
    ? asked
    : isCurrency(saved)
      ? saved
      : "NGN";
  const interval = query.interval === "annually" ? "annually" : "monthly";
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(landingJsonLd(env.NEXT_PUBLIC_APP_URL)),
        }}
        type="application/ld+json"
      />
      <Landing initialCurrency={currency} initialInterval={interval} />
    </>
  );
}
