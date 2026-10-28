import { Suspense } from "react";

import { getDirection } from "@/directions/registry";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const D = await getDirection();
  return (
    <Suspense>
      <D.Auth mode="sign-in" />
    </Suspense>
  );
}
