import { Suspense } from "react";
import { AuthForm } from "@/features/auth";
import { AuthSplitLayout } from "@/components/layout/AuthSplitLayout";

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <Suspense>
        <AuthForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
