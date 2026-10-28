import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { headers } from "next/headers";
import Link from "next/link";

import { getServerContext } from "@/server/context";
import { AcceptInvite } from "./accept-invite";

export const metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requestHeaders = await headers();
  const { authService } = getServerContext();
  const session = await authService.auth.api.getSession({
    headers: requestHeaders,
  });
  const callback = `/accept-invite/${id}`;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Join an organization</CardTitle>
          <CardDescription>
            Invitations only work for the email address they were sent to, and
            expire after 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session ? (
            <AcceptInvite invitationId={id} />
          ) : (
            <div className="flex gap-2">
              <Button asChild>
                <Link
                  href={`/sign-up?callbackURL=${encodeURIComponent(callback)}`}
                >
                  Create account
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link
                  href={`/sign-in?callbackURL=${encodeURIComponent(callback)}`}
                >
                  Sign in
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
