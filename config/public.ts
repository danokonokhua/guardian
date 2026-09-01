/**
 * Browser-safe configuration (NEXT_PUBLIC_* variables only).
 *
 * This module and its transitive imports (`config/env.ts`) reference ONLY
 * public variable names, so bundling it into client code leaks nothing.
 * Server-only variables (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, …) live in
 * `config/server.ts`, which is guarded by the `server-only` marker.
 *
 * NOTE for future client components: Next.js statically replaces only
 * *literal* `process.env.NEXT_PUBLIC_*` expressions in client bundles. When
 * a client component eventually needs public config, either receive it via
 * props from a server component (preferred) or read the literal
 * `process.env.NEXT_PUBLIC_*` expression directly. Server-side consumers
 * should use `loadPublicConfig()` / `config/server.ts`.
 */
import { parsePublicConfig, type PublicConfig } from "@/config/env";

export type { PublicConfig };

/** Loads and validates the browser-safe configuration subset. */
export function loadPublicConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): PublicConfig {
  return parsePublicConfig(env);
}
