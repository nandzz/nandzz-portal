import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth";
import { AuthSplitLayout } from "@/components/layout/AuthSplitLayout";

export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthSplitLayout>
  );
}
