"use client";

import { AuthShell } from "@/components/ui/auth-shell";
import { GlassButton } from "@/components/ui/glass-button";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      setError("Unable to sign in with those credentials.");
      setSubmitting(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthShell>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/10 border border-primary-container/20 text-primary-container font-mono text-[11px] mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_6px_#00F0FF] animate-pulse" />
        <span>SECURE OPERATOR ACCESS</span>
      </div>

      <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
        Sign in to Guardian
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Access your digital operations workspace and active monitors.
      </p>

      <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm">
          <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
            Email
          </span>
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="operator@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full mt-2 min-h-[44px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-4 py-2.5 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
          />
        </label>

        <label className="block text-sm">
          <div className="flex items-center justify-between">
            <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
              Password
            </span>
            <Link
              href="/forgot-password"
              className="text-xs font-mono text-primary-fixed-dim hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <input
            required
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          {submitting ? "Authenticating…" : "Sign In to Workspace →"}
        </GlassButton>

        <div className="pt-2 text-center">
          <p className="text-xs text-on-surface-variant">
            Don't have a workspace?{" "}
            <Link
              href="/signup"
              className="font-semibold text-primary hover:text-primary-container underline decoration-primary-container/40 underline-offset-4 transition-colors"
            >
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
