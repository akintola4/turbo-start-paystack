import { getDirection } from "@/directions/registry";
import { loadOrgPicker } from "@/server/views";

export const metadata = { title: "Your organizations" };

export default async function OrganizationsPage() {
  const [D, data] = await Promise.all([getDirection(), loadOrgPicker()]);
  return <D.OrgPicker data={data} />;
}
