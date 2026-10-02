import Link from "next/link";
import { Brand } from "@/components/ui/brand";

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
          <Brand />
          <Link href="/login" className="text-sm text-indigo-300 hover:text-indigo-200">
            Sign in
          </Link>
        </div>
        <section className="rounded-2xl border border-indigo-400/20 bg-surface-raised p-6 sm:p-8 shadow-xl">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-indigo-300">
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
