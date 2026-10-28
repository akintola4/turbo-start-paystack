import { Suspense } from "react";

import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense>
      <AuthScreen mode="sign-up" />
    </Suspense>
  );
}
