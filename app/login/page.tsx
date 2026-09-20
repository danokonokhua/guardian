"use client";

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
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-xl">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">Guardian</p>
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
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-500"
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
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-500"
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
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <a
            href="/signup"
            className="block w-full rounded-md border border-emerald-600 px-4 py-2 text-center text-sm font-medium text-emerald-300 hover:border-emerald-500 hover:bg-emerald-950/40"
          >
            Create an account
          </a>
          <p className="text-center text-sm text-neutral-400">
            <a className="text-emerald-400 hover:text-emerald-300" href="/forgot-password">
              Forgot your password?
            </a>
          </p>
          <p className="text-center text-sm text-neutral-400">
            New to Guardian?{" "}
            <a className="text-emerald-400 hover:text-emerald-300" href="/signup">
              Sign up
            </a>
          </p>
        </form>
      </section>
    </main>
  );
}
