import {
  type Currency,
  catalog,
  formatMoney,
  getPlan,
  getPlanPrice,
  planPriceId,
} from "@workspace/billing";
import { env as clientEnv } from "@workspace/env/client";
import { env } from "@workspace/env/server";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { notFound } from "next/navigation";

import { BillingButton } from "@/components/billing-actions";
import { getServerContext } from "@/server/context";
import { requireOrgBySlug } from "@/server/session";

export const metadata = { title: "Billing" };

const STATUS_VARIANT = {
  active: "success",
  trialing: "secondary",
  past_due: "warning",
  non_renewing: "outline",
  canceled: "destructive",
  expired: "destructive",
  incomplete: "outline",
} as const;

const date = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : "—";

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ payment?: string; interval?: string }>;
}) {
  const { orgSlug } = await params;
  const { payment, interval: intervalParam } = await searchParams;
  const { organization, can } = await requireOrgBySlug(orgSlug);
  if (!can("billing:view")) {
    notFound();
  }
  const canManage = can("billing:manage");
  const { billing } = getServerContext();
  const [sub, entitlement, invoices] = await Promise.all([
    billing.getSubscription(organization.id),
    billing.getEntitlement(organization.id),
    billing.listInvoices(organization.id),
  ]);
  const currency = (sub?.currency ?? env.BILLING_CURRENCY) as Currency;
  const interval = intervalParam === "annually" ? "annually" : "monthly";
  const currentPrice = sub ? getPlanPrice(sub.planPriceId) : undefined;
  const scheduled = sub?.scheduledPlanPriceId
    ? getPlanPrice(sub.scheduledPlanPriceId)
    : undefined;
  const publicKey = clientEnv.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

  return (
    <div className="grid gap-6">
      <h1 className="font-semibold text-2xl">Billing</h1>

      {payment === "succeeded" ? (
        <Alert>
          <AlertTitle>Payment confirmed</AlertTitle>
        </Alert>
      ) : payment === "created" ? (
        <Alert>
          <AlertTitle>Waiting for Paystack</AlertTitle>
          <AlertDescription>
            We haven't received confirmation yet. Refresh in a moment.
          </AlertDescription>
        </Alert>
      ) : null}

      {sub?.status === "past_due" ? (
        <Alert variant="warning">
          <AlertTitle>Your last payment failed</AlertTitle>
          <AlertDescription>
            Update your card before {date(sub.graceUntil)} to keep access.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {entitlement.plan.name}
            {sub ? (
              <Badge
                data-testid="subscription-status"
                variant={STATUS_VARIANT[sub.status]}
              >
                {sub.status.replace("_", " ")}
              </Badge>
            ) : (
              <Badge data-testid="subscription-status" variant="outline">
                free
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {sub && currentPrice
              ? `${formatMoney(currentPrice.amountSubunit, currentPrice.currency)} / ${currentPrice.interval === "monthly" ? "month" : "year"}`
              : "No paid subscription."}
          </CardDescription>
        </CardHeader>
        {sub ? (
          <CardContent className="grid gap-1 text-sm">
            {sub.status === "trialing" ? (
              <p>
                Trial ends {date(sub.trialEndsAt)}. Your card is charged then.
              </p>
            ) : null}
            <p>
              {sub.cancelAtPeriodEnd ? "Access ends" : "Renews"}{" "}
              {date(sub.currentPeriodEnd)}
            </p>
            {sub.cardLast4 ? (
              <p>
                Card: {sub.cardBrand} •••• {sub.cardLast4} (exp {sub.cardExp})
              </p>
            ) : null}
            {scheduled ? (
              <p>
                Switches to {getPlan(scheduled.planKey)?.name} (
                {scheduled.interval}) on {date(sub.currentPeriodEnd)}.
              </p>
            ) : null}
          </CardContent>
        ) : null}
        {sub && canManage ? (
          <CardFooter className="flex flex-wrap gap-2">
            {sub.status === "non_renewing" ? (
              <BillingButton action="resume" orgId={organization.id}>
                Resume subscription
              </BillingButton>
            ) : (
              <BillingButton
                action="cancel"
                confirm="Cancel at the end of the current period?"
                orgId={organization.id}
                variant="outline"
              >
                Cancel subscription
              </BillingButton>
            )}
            <BillingButton
              action="manage-card"
              orgId={organization.id}
              variant="outline"
            >
              Update card
            </BillingButton>
          </CardFooter>
        ) : null}
      </Card>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">Prices in {currency}</span>
        <a
          className={interval === "monthly" ? "font-medium" : "underline"}
          href="?interval=monthly"
        >
          Monthly
        </a>
        <a
          className={interval === "annually" ? "font-medium" : "underline"}
          href="?interval=annually"
        >
          Annually
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {catalog.map((plan) => {
          const id = plan.prices.length
            ? planPriceId(plan.key, interval, currency)
            : null;
          const price = id ? getPlanPrice(id) : undefined;
          const isCurrent = sub?.planPriceId === id;
          return (
            <Card key={plan.key}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <p className="font-semibold text-xl">
                  {price
                    ? formatMoney(price.amountSubunit, price.currency)
                    : "Free"}
                  {price ? (
                    <span className="font-normal text-muted-foreground text-sm">
                      {" "}
                      / {interval === "monthly" ? "month" : "year"}
                    </span>
                  ) : null}
                </p>
                <ul className="text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                  {plan.trialDays > 0 ? (
                    <li>{plan.trialDays}-day trial, card required</li>
                  ) : null}
                </ul>
              </CardContent>
              <CardFooter>
                {!(price && id) ? null : isCurrent ? (
                  <Badge variant="secondary">Current plan</Badge>
                ) : (
                  <BillingButton
                    action={sub ? "change-plan" : "checkout"}
                    disabled={!canManage}
                    orgId={organization.id}
                    planPriceId={id}
                    publicKey={publicKey}
                  >
                    {sub ? `Switch to ${plan.name}` : `Choose ${plan.name}`}
                  </BillingButton>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
      {canManage ? null : (
        <p className="text-muted-foreground text-sm">
          Only owners and billing managers can change the plan.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {date(invoice.paidAt ?? invoice.createdAt)}
                    </TableCell>
                    <TableCell>
                      {invoice.description ?? "Subscription"}
                    </TableCell>
                    <TableCell>
                      {formatMoney(
                        invoice.amountSubunit,
                        invoice.currency as Currency
                      )}
                    </TableCell>
                    <TableCell>{invoice.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
