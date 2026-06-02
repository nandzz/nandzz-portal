import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-violet-100/50 blur-3xl dark:bg-violet-950/25" />
        <div className="absolute right-1/4 top-1/3 h-[300px] w-[300px] rounded-full bg-fuchsia-100/30 blur-3xl dark:bg-fuchsia-950/15" />
      </div>
      {/* Grid pattern */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,oklch(0.7_0_0_/_0.03)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.7_0_0_/_0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] dark:bg-[linear-gradient(to_right,oklch(0.5_0_0_/_0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0_0_/_0.04)_1px,transparent_1px)]" />

      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
