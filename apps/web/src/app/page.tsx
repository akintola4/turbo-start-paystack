import { Button } from "@workspace/ui/components/button";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-4 py-16">
      <p className="font-mono text-muted-foreground text-sm">
        turbo-start-paystack
      </p>
      <h1 className="text-balance font-semibold text-4xl tracking-tight">
        Ship B2B SaaS that bills in naira, cedis, rand and shillings.
      </h1>
      <p className="text-pretty text-lg text-muted-foreground">
        Organizations, roles and invitations, with Paystack subscriptions that
        are driven by verified webhooks, not by the browser.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/sign-up">Create an account</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
