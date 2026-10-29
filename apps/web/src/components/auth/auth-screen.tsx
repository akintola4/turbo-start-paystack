import { AuthForm, AuthSwitch } from "@/components/auth/auth-form";
import { GlyphMosaic, Wordmark } from "@/components/primitives";

export function AuthScreen({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10 sm:py-8">
        <Wordmark />
        <main className="flex flex-1 items-center py-12">
          <div className="mx-auto grid w-full max-w-sm gap-8">
            <div className="grid gap-2">
              <h1 className="font-semibold text-[32px] leading-tight tracking-[-0.02em]">
                {mode === "sign-in" ? "Welcome back" : "Create your account"}
              </h1>
              <p className="text-muted-foreground">
                {mode === "sign-in"
                  ? "Sign in to manage your team and billing."
                  : "You'll verify your email, then set up your organization."}
              </p>
            </div>
            <AuthForm
              className="[&_[data-slot=input]]:h-11 [&_[data-slot=input]]:px-3.5 [&_[data-slot=input]]:text-[15px]"
              footer={<AuthSwitch className="text-center" mode={mode} />}
              mode={mode}
              submitClassName=""
            />
          </div>
        </main>
      </div>
      <aside
        data-surface="panel"
        className="dark relative hidden overflow-hidden p-10 lg:m-3 lg:flex lg:flex-col lg:justify-between lg:rounded-panel"
      >
        <GlyphMosaic />
        <p className="max-w-[28ch] text-balance font-medium text-[28px] leading-tight tracking-[-0.02em]">
          One subscription engine for every currency Paystack settles.
        </p>
      </aside>
    </div>
  );
}
