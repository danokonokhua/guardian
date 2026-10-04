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
      "playwright-report/**",
      "test-results/**",
      "guardian-cpanel-release/**",
      "next-env.d.ts",
      "package-lock.json",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.mjs"],
    rules: {
      // Guardian convention: `lib/logger.ts` is the single sanctioned consumer
      // of the console APIs (it disables this rule locally with a justification).
      // All other code must use the structured logger.
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["tests/**", "scripts/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-console": "off",
    },
  },
];

export default eslintConfig;
