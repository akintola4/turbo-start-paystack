import { getDirection } from "@/directions/registry";
import { loadMembers } from "@/server/views";

export const metadata = { title: "Members" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  // Every query is scoped by the organization resolved from the slug and the
  // caller's membership, never by an id from the client.
  const [D, data] = await Promise.all([getDirection(), loadMembers(orgSlug)]);
  return <D.Members data={data} />;
}
