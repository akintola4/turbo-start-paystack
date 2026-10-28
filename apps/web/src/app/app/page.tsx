import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import Link from "next/link";

import { CreateOrgForm } from "@/components/create-org-form";
import { SignOutButton } from "@/components/sign-out-button";
import { listMyOrganizations, requireSession } from "@/server/session";

export const metadata = { title: "Your organizations" };

export default async function OrganizationsPage() {
  const session = await requireSession();
  const orgs = await listMyOrganizations(session.user.id);

  return (
    <main className="mx-auto grid max-w-2xl gap-6 px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl">Organizations</h1>
          <p className="text-muted-foreground text-sm">
            Signed in as {session.user.email}
            {session.user.emailVerified ? "" : " (email not verified)"}
          </p>
        </div>
        <SignOutButton />
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Your organizations</CardTitle>
          <CardDescription>
            Billing, members and roles belong to an organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {orgs.length === 0 ? (
            <p className="text-muted-foreground text-sm">None yet.</p>
          ) : (
            <ul className="grid gap-1">
              {orgs.map((org) => (
                <li key={org.id}>
                  <Link
                    className="flex justify-between rounded-md px-2 py-1.5 hover:bg-accent"
                    href={`/app/${org.slug}`}
                  >
                    <span>{org.name}</span>
                    <span className="text-muted-foreground text-sm">
                      {org.role}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>New organization</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>
    </main>
  );
}
