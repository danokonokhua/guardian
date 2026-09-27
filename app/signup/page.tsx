"use client";

import { AuthShell } from "@/components/ui/auth-shell";

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
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Unable to create your account.");
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
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-300">
        SECURE WORKSPACE
      </p>
      <h1 className="mt-3 text-2xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Start a Guardian organization and invite your team later.
      </p>

      <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm">
          <span className="text-neutral-300">Name (optional)</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="guardian-input mt-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-300">Organization name (optional)</span>
          <input
            type="text"
            autoComplete="organization"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="My Organization"
            className="guardian-input mt-2"
          />
        </label>
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
            minLength={1}
            maxLength={256}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="guardian-input mt-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-neutral-300">Confirm password</span>
          <input
            required
            minLength={1}
            maxLength={256}
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
          {submitting ? "Creating account…" : "Create account"}
        </button>
        <p className="text-center text-sm text-neutral-400">
          Already have an account?{" "}
          <a className="text-indigo-300 hover:text-indigo-200" href="/login">
            Sign in
          </a>
        </p>
      </form>
    </AuthShell>
  );
}
