import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { OrgPicker } from "@/components/orgs/org-picker";
import { LAST_ORG_COOKIE, landingOrg } from "@/lib/org-view";
import { loadOrgPicker } from "@/server/views";

export const metadata = { title: "Organizations" };

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const data = await loadOrgPicker();
  // Straight after sign-in, skip the picker when the choice is obvious.
  // Opened from the menu, /app is always the list.
  if ((await searchParams).from === "sign-in") {
    const slug = landingOrg(
      data.orgs.map((o) => o.slug),
      (await cookies()).get(LAST_ORG_COOKIE)?.value
    );
    if (slug) {
      redirect(`/app/${slug}`);
    }
  }
  return <OrgPicker data={data} />;
}
