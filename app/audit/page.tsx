import Link from "next/link";

import AuditForm from "@/app/audit/audit-form";

export const metadata = {
  title: "Free website audit",
  description: "Run a bounded Guardian health audit of your public website.",
};

export default function AuditPage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-neutral-400 hover:text-emerald-300">
            ← Guardian
          </Link>
          <Link href="/login" className="text-sm text-emerald-400 hover:text-emerald-300">
            Sign in
          </Link>
        </div>
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-xl">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-400">
            Free audit
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            See what is affecting your website.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
            Guardian checks availability, server response time, basic SEO, and basic security in one
            bounded snapshot. No login is required.
          </p>
          <AuditForm />
        </section>
      </div>
    </main>
  );
}
