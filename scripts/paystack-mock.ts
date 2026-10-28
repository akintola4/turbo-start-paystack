// pnpm paystack:mock
// A local stand-in for api.paystack.co so the app runs end to end without
// Paystack keys. Point the app at it with PAYSTACK_API_URL=http://localhost:4010
// Its hosted "checkout" page fires signed charge.success / subscription.create
// webhooks at the app, like Paystack would. Development only.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { signPaystackPayload } from "@workspace/billing";
import { createFakePaystack } from "@workspace/billing/fake";
import { chargeSuccess, subscriptionCreate } from "@workspace/billing/fixtures";

const PORT = Number(process.env.PAYSTACK_MOCK_PORT ?? 4010);
const ORIGIN = `http://localhost:${PORT}`;
const WEBHOOK_URL =
  process.env.PAYSTACK_MOCK_WEBHOOK_URL ??
  "http://localhost:3000/api/webhooks/paystack";
const SECRET = process.env.PAYSTACK_SECRET_KEY ?? "sk_test_local_mock";
const STATE_FILE = new URL("./.paystack-mock.json", import.meta.url);

if (process.env.NODE_ENV === "production") {
  throw new Error("paystack-mock is for local development only");
}

const fake = createFakePaystack({ checkoutBaseUrl: `${ORIGIN}/checkout` });
if (existsSync(STATE_FILE)) {
  fake.restore(JSON.parse(readFileSync(STATE_FILE, "utf8")));
}
const save = () => writeFileSync(STATE_FILE, JSON.stringify(fake.snapshot()));

async function sendWebhook(payload: unknown) {
  const body = JSON.stringify(payload);
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-paystack-signature": signPaystackPayload(body, SECRET),
    },
    body,
  });
  console.log(
    `webhook ${(payload as { event: string }).event} → ${res.status}`
  );
}

function findByAccessCode(accessCode: string) {
  return [...fake.transactions.values()].find(
    (t) => t.access_code === accessCode
  );
}

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title>
<body style="font-family:system-ui;max-width:28rem;margin:4rem auto;padding:0 1rem">${body}</body>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", ORIGIN);
  const checkout = url.pathname.match(/^\/checkout\/(acc_[a-f0-9]+)(\/pay)?$/);

  if (checkout?.[1]) {
    const tx = findByAccessCode(checkout[1]);
    if (!tx) {
      res.writeHead(404).end("unknown checkout");
      return;
    }
    if (req.method === "POST" && checkout[2]) {
      const { transaction, subscription } = fake.pay(tx.reference);
      save();
      const customer = { customer_code: tx.customer_code, email: tx.email };
      // Paystack does not guarantee order; send both, charge first.
      await sendWebhook(
        chargeSuccess({
          reference: tx.reference,
          amount: transaction.amount,
          currency: transaction.currency,
          customer,
          metadata: tx.metadata,
          planCode: tx.plan,
        })
      );
      if (subscription) {
        await sendWebhook(
          subscriptionCreate({
            subscriptionCode: subscription.subscription_code,
            emailToken: subscription.email_token,
            planCode: subscription.plan,
            amount: transaction.amount,
            customer,
            nextPaymentDate: subscription.next_payment_date,
          })
        );
      }
      const callback = new URL(
        tx.callback_url ?? "http://localhost:3000/billing/callback"
      );
      callback.searchParams.set("reference", tx.reference);
      res.writeHead(303, { location: callback.toString() }).end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html" }).end(
      page(
        "Mock Paystack checkout",
        `<h1>Mock Paystack checkout</h1>
<p>${tx.email} · ${tx.currency} ${(tx.amount / 100).toFixed(2)}${tx.plan ? ` · plan ${tx.plan}` : ""}</p>
<p style="color:#666">Local development only. No money moves.</p>
<form method="post" action="/checkout/${checkout[1]}/pay"><button style="padding:.6rem 1rem">Pay with test card 4084 0840 8408 4081</button></form>`
      )
    );
    return;
  }

  // Everything else is the Paystack API.
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = chunks.length ? Buffer.concat(chunks).toString() : undefined;
  const response = await fake.handle(
    new Request(url, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body: req.method === "GET" ? undefined : body,
    })
  );
  save();
  res
    .writeHead(response.status, { "content-type": "application/json" })
    .end(await response.text());
});

server.listen(PORT, () => {
  console.log(`Mock Paystack on ${ORIGIN} → webhooks to ${WEBHOOK_URL}`);
});
