import { Suspense } from "react";

import { AuthScreen } from "@/components/auth/auth-screen";
import { ResetPasswordForm } from "@/components/auth/password-reset";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthScreen
      description="Pick something you haven't used here before. You'll sign in with it next."
      title="Choose a new password"
      variant="sign-in"
    >
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthScreen>
  );
}
