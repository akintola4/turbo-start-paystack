import { OrgSettings } from "@/components/settings/org-settings";
import { loadOrgSettings } from "@/server/views";

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Scoped by the org resolved from the slug and the caller's membership;
  // what each role may change is decided there and again on every route.
  return <OrgSettings data={await loadOrgSettings(orgSlug)} />;
}
