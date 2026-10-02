"use client";

import { AuthShell } from "@/components/ui/auth-shell";

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
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-300">
        SECURE WORKSPACE
      </p>
      <h1 className="mt-3 text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-neutral-400">Use your Guardian organization account.</p>
      <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm">
          <span className="text-neutral-300">Email</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="guardian-input mt-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-300">Password</span>
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="guardian-input mt-2"
          />
        </label>
        {error !== null && (
          <p
            role="alert"
            className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"
          >
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className="button-primary w-full">
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <a
          href="/signup"
          className="block w-full rounded-md border border-indigo-500/50 px-4 py-2 text-center text-sm font-medium text-indigo-200 hover:border-indigo-400 hover:bg-indigo-950/40"
        >
          Create an account
        </a>
        <p className="text-center text-sm text-neutral-400">
          <a className="text-indigo-300 hover:text-indigo-200" href="/forgot-password">
            Forgot your password?
          </a>
        </p>
        <p className="text-center text-sm text-neutral-400">
          New to Guardian?{" "}
          <a className="text-indigo-300 hover:text-indigo-200" href="/signup">
            Sign up
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
