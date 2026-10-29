import { Suspense } from "react";

import { AuthForm, AuthSwitch } from "@/components/auth/auth-form";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthScreen
      description="Sign in to manage your team and billing."
      footer={
        <Suspense>
          <AuthSwitch mode="sign-in" />
        </Suspense>
      }
      title="Welcome back"
      variant="sign-in"
    >
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
    </AuthScreen>
  );
}
