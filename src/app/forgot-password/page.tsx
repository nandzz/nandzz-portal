import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/auth";
import { AuthSplitLayout } from "@/components/layout/AuthSplitLayout";

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
