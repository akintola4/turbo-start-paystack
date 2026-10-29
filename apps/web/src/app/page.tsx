import { isCurrency } from "@workspace/billing/money";
import { cookies } from "next/headers";

import { Landing } from "@/components/landing/landing";

/**
 * Reads the remembered currency so the server renders prices, the receipt
 * and the footer tile in it: no flash of naira for a visitor who chose rand.
 */
export default async function HomePage() {
  const saved = (await cookies()).get("tsp-currency")?.value ?? "";
  return <Landing initialCurrency={isCurrency(saved) ? saved : "NGN"} />;
}
