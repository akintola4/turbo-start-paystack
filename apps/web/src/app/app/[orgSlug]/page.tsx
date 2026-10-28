import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

import { getServerContext } from "@/server/context";
import { requireOrgBySlug } from "@/server/session";

export default async function OrgOverviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization } = await requireOrgBySlug(orgSlug);
  // Paid features check this on the server (PLAN §2.3 #7).
  const entitlement = await getServerContext().billing.getEntitlement(
    organization.id
  );

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
        <CardContent className="grid gap-2 text-muted-foreground text-sm">
          <p data-testid="entitlement">
            Plan: {entitlement.plan.name} ·{" "}
            {entitlement.active ? "paid features on" : "paid features off"} (
            {entitlement.reason.replaceAll("_", " ")})
          </p>
          <p>
            Gate paid features with this server-side entitlement, never with
            anything the browser sends.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
