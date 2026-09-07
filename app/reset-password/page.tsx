import { Suspense } from "react";

import ResetPasswordForm from "./reset-password-form";

function ResetPasswordFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-xl">
        <p className="text-sm text-neutral-400">Loading password reset…</p>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
