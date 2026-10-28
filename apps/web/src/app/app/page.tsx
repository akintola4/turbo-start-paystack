import { OrgPicker } from "@/components/orgs/org-picker";
import { loadOrgPicker } from "@/server/views";

export const metadata = { title: "Your organizations" };

export default async function OrganizationsPage() {
  return <OrgPicker data={await loadOrgPicker()} />;
}
