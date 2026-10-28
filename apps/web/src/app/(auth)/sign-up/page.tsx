import { Suspense } from "react";

import { getDirection } from "@/directions/registry";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  const D = await getDirection();
  return (
    <Suspense>
      <D.Auth mode="sign-up" />
    </Suspense>
  );
}
