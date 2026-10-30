import { Billing } from "@/components/billing/billing";
import { BillingDenied } from "@/components/billing/billing-denied";
import { loadBilling, loadBillingDenied } from "@/server/views";

export const metadata = { title: "Billing" };

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ payment?: string; interval?: string; page?: string }>;
}) {
  const { orgSlug } = await params;
  const denied = await loadBillingDenied(orgSlug);
  if (denied) {
    return <BillingDenied data={denied} />;
  }
  return <Billing data={await loadBilling(orgSlug, await searchParams)} />;
}
