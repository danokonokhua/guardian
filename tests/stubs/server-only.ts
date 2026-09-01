/**
 * Test stub for the `server-only` package.
 *
 * The real package throws when a bundler includes it in a Client Component
 * bundle. Under Vitest (plain Node, no bundler boundary) tests import the
 * server configuration directly, so the marker must resolve to a no-op.
 * Wired up via `resolve.alias` in vitest.config.ts.
 */
export {};
