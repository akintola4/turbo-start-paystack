import { Billing } from "@/components/billing/billing";
import { loadBilling } from "@/server/views";

export const metadata = { title: "Billing" };

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ payment?: string; interval?: string }>;
}) {
  const { orgSlug } = await params;
  return <Billing data={await loadBilling(orgSlug, await searchParams)} />;
}
