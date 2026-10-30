import { Account } from "@/components/settings/account";
import { loadAccount } from "@/server/views";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  // Everything here is the signed-in user's own: no org, no ids from the
  // client.
  return <Account data={await loadAccount()} />;
}
