import { getDirection } from "@/directions/registry";
import { loadDashboard } from "@/server/views";

export const metadata = { title: "Overview" };

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Paid features check the entitlement on the server (PLAN §2.3 #7).
  const [D, data] = await Promise.all([getDirection(), loadDashboard(orgSlug)]);
  return <D.Dashboard data={data} />;
}
