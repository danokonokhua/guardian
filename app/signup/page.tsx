"use client";

import { AuthShell } from "@/components/ui/auth-shell";
import { GlassButton } from "@/components/ui/glass-button";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          organizationName: organizationName || undefined,
          email,
          password,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string } | string;
        } | null;
        const msg = typeof body?.error === "object" ? body.error?.message : body?.error;
        setError(msg ?? "Unable to create your account.");
        setSubmitting(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to create your account. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <AuthShell signup>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container/10 border border-primary-container/20 text-primary-container font-mono text-[11px] mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-container shadow-[0_0_6px_#00F0FF] animate-pulse" />
        <span>INSTANT WORKSPACE SETUP</span>
      </div>

      <h1 className="font-headline text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
        Create your account
      </h1>
      <p className="mt-1.5 text-sm text-on-surface-variant">
        Initialize your Guardian organization and deploy monitors in minutes.
      </p>

      <form className="mt-6 space-y-3.5" onSubmit={(event) => void submit(event)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
              Name (optional)
            </span>
            <input
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full mt-1.5 min-h-[42px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-3.5 py-2 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
            />
          </label>
          <label className="block text-sm">
            <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
              Organization (optional)
            </span>
            <input
              type="text"
              autoComplete="organization"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="Acme Global"
              className="w-full mt-1.5 min-h-[42px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-3.5 py-2 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
            Email
          </span>
          <input
            required
            type="email"
            autoComplete="email"
            placeholder="jane@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full mt-1.5 min-h-[42px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-3.5 py-2 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
              Password
            </span>
            <input
              required
              minLength={8}
              maxLength={256}
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 chars"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full mt-1.5 min-h-[42px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-3.5 py-2 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
            />
          </label>
          <label className="block text-sm">
            <span className="text-on-surface font-medium text-xs uppercase tracking-wider font-mono">
              Confirm password
            </span>
            <input
              required
              minLength={8}
              maxLength={256}
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full mt-1.5 min-h-[42px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-3.5 py-2 text-sm text-white placeholder:text-outline/50 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] transition-all"
            />
          </label>
        </div>

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
          {submitting ? "Creating workspace…" : "Create account"}
        </GlassButton>

        <div className="pt-2 text-center">
          <p className="text-xs text-on-surface-variant">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:text-primary-container underline decoration-primary-container/40 underline-offset-4 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  );
}
