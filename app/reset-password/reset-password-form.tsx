"use client";

import { AuthShell } from "@/components/ui/auth-shell";
import { GlassButton } from "@/components/ui/glass-button";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const token = searchParams.get("token");
    if (token === null) {
      setError("This reset link is invalid or has expired. Request a new one.");
      setSubmitting(false);
      return;
    }
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (!response.ok) {
      setError("This reset link is invalid or has expired. Request a new one.");
      setSubmitting(false);
      return;
    }
    router.replace("/login?reset=success");
  }

  return (
    <AuthShell>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/10 border border-primary-container/20 text-primary-container font-mono text-[11px] mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_6px_#00F0FF] animate-pulse" />
        <span>SECURITY VERIFICATION</span>
      </div>

      <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
        Choose New Password
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Select a secure password (minimum 8 characters) for your account.
      </p>

      <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm">
          <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
            New Password
          </span>
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full mt-2 min-h-[44px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-4 py-2.5 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
          />
        </label>

        <label className="block text-sm">
          <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
            Confirm Password
          </span>
          <input
            required
            minLength={8}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="w-full mt-2 min-h-[44px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-4 py-2.5 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
          />
        </label>

        {error !== null && (
          <div
            role="alert"
            className="rounded-xl border border-status-outage/40 bg-status-outage/10 p-3 text-xs sm:text-sm text-status-outage flex items-center gap-2"
          >
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <GlassButton
          variant="primary"
          size="md"
          type="submit"
          disabled={submitting}
          className="w-full mt-2"
        >
          {submitting ? "Updating credentials…" : "Update Password & Sign In →"}
        </GlassButton>

        <div className="pt-2 text-center">
          <Link
            href="/login"
            className="text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
