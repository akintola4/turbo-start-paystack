import { getDirection } from "@/directions/registry";
import { loadAcceptInvite } from "@/server/views";

export const metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [D, data] = await Promise.all([getDirection(), loadAcceptInvite(id)]);
  return <D.AcceptInvite data={data} />;
}
