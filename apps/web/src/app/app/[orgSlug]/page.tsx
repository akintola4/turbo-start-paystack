import { Dashboard } from "@/components/dashboard/dashboard";
import { loadDashboard } from "@/server/views";

export const metadata = { title: "Overview" };

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Paid features check the entitlement on the server (PLAN §2.3 #7).
  return <Dashboard data={await loadDashboard(orgSlug)} />;
}
