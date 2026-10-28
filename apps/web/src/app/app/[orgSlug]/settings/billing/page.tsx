import { getDirection } from "@/directions/registry";
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
  const [D, data] = await Promise.all([
    getDirection(),
    loadBilling(orgSlug, await searchParams),
  ]);
  return <D.Billing data={data} />;
}
