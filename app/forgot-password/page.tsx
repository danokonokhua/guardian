"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url !== undefined && anonKey !== undefined ? createBrowserClient(url, anonKey) : null;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setSubmitting(true);
    const supabase = getSupabaseClient();
    if (supabase === null) {
      setError("Supabase authentication is not configured.");
      setSubmitting(false);
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError !== null) {
      const providerMessage = resetError.message.toLowerCase();
      setError(
        providerMessage.includes("redirect")
          ? "Supabase rejected the reset redirect. Add http://localhost:3000/reset-password to Supabase Auth redirect URLs."
          : providerMessage.includes("rate")
            ? "Too many reset requests. Wait a few minutes and try again."
            : "Unable to send a password reset email. Check the Supabase email provider settings.",
      );
    } else {
      setMessage("If an account exists for that email, a reset link has been sent.");
    }
    setSubmitting(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-xl">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">Guardian</p>
        <h1 className="mt-3 text-2xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-neutral-400">We’ll email you a secure reset link.</p>
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
          {error !== null && (
            <p
              role="alert"
              className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          {message !== null && (
            <p
              role="status"
              className="rounded-md border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-300"
            >
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
          <p className="text-center text-sm text-neutral-400">
            <a className="text-emerald-400" href="/login">
              Back to sign in
            </a>
          </p>
        </form>
      </section>
    </main>
  );
}
