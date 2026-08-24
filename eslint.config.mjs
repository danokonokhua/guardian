import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Guardian ESLint configuration (flat config).
 *
 * `eslint-config-next@16` ships native flat-config exports:
 *   - "eslint-config-next/core-web-vitals" — Next.js rules (build/lint correctness)
 *   - "eslint-config-next/typescript"       — typescript-eslint strict rules
 *
 * The legacy FlatCompat bridge crashes on this version (circular plugin
 * structure), so the native exports are used directly.
 */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
      "package-lock.json",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // Guardian convention: `lib/logger.ts` is the single sanctioned consumer
      // of the console APIs (it disables this rule locally with a justification).
      // All other code must use the structured logger.
      "no-console": "error",
    },
  },
];

export default eslintConfig;
