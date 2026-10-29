import { AcceptInvite } from "@/components/auth/accept-invite";
import { loadAcceptInvite } from "@/server/views";

export const metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AcceptInvite data={await loadAcceptInvite(id)} />;
}
