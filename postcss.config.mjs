/**
 * Tailwind CSS v4 integrates with Next.js through the PostCSS plugin.
 * The design system itself (tokens, components) is intentionally minimal in
 * Phase 1B — it exists only to prove the pipeline and support later phases.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
