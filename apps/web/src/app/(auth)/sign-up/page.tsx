import { headers } from "next/headers";
import { Suspense } from "react";

import { AuthForm, AuthSwitch } from "@/components/auth/auth-form";
import { AuthScreen } from "@/components/auth/auth-screen";
import { currencyFromAcceptLanguage } from "@/lib/locale-currency";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  const currency = currencyFromAcceptLanguage(
    (await headers()).get("accept-language")
  );
  return (
    <AuthScreen
      currency={currency}
      description="You'll verify your email, then set up your organization."
      footer={
        <Suspense>
          <AuthSwitch mode="sign-up" />
        </Suspense>
      }
      title="Create your account"
      variant="sign-up"
    >
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
    </AuthScreen>
  );
}
