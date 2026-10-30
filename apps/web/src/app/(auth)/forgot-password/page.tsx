import { Suspense } from "react";

import { AuthScreen } from "@/components/auth/auth-screen";
import { ForgotPasswordForm } from "@/components/auth/password-reset";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      description="Enter the email you sign in with and we'll send a link to choose a new password."
      title="Reset your password"
      variant="sign-in"
    >
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthScreen>
  );
}
