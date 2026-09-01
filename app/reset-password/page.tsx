"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url !== undefined && anonKey !== undefined ? createBrowserClient(url, anonKey) : null;
}

export default function ResetPasswordPage() {
  const router = useRouter();
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
    const supabase = getSupabaseClient();
    if (supabase === null) {
      setError("Supabase authentication is not configured.");
      setSubmitting(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError !== null) {
      setError("This reset link is invalid or has expired. Request a new one.");
      setSubmitting(false);
      return;
    }
    router.replace("/login?reset=success");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-xl">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">Guardian</p>
        <h1 className="mt-3 text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Enter and confirm your new Supabase password.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm">
            <span className="text-neutral-300">New password</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-emerald-500"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-300">Confirm password</span>
            <input
              required
              minLength={8}
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
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
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save new password"}
          </button>
        </form>
      </section>
    </main>
  );
}
