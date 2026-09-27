"use client";

import { AuthShell } from "@/components/ui/auth-shell";

import { FormEvent, useState } from "react";

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
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (response.ok) {
      setMessage("If an account exists for that email, a reset link has been sent.");
    } else {
      setError("Unable to process the password reset request.");
    }
    setSubmitting(false);
  }

  return (
    <AuthShell>
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-300">
        SECURE WORKSPACE
      </p>
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
        {message !== null && (
          <p
            role="status"
            className="rounded-md border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-indigo-200"
          >
            {message}
          </p>
        )}
        <button type="submit" disabled={submitting} className="button-primary w-full">
          {submitting ? "Sending…" : "Send reset link"}
        </button>
        <p className="text-center text-sm text-neutral-400">
          <a className="text-indigo-300" href="/login">
            Back to sign in
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
