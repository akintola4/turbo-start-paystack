import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

import { requireOrgBySlug } from "@/server/session";

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } = await requireOrgBySlug(orgSlug);

  return (
    <div className="grid gap-6">
      <h1 className="font-semibold text-2xl">{organization.name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your product goes here</CardTitle>
          <CardDescription>
            This page is only reachable by members of {organization.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Gate paid features with the entitlement computed on the server, not
          with anything the browser sends.
        </CardContent>
      </Card>
    </div>
  );
}
