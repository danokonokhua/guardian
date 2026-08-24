import type { NextConfig } from "next";

/**
 * Guardian Next.js configuration.
 *
 * Foundation-level security headers only. The full security architecture
 * (SSRF-hardened fetch service, CSP, rate limiting) arrives with the
 * monitoring scanner and authentication phases.
 *
 * NOTE: reading `process.env.NODE_ENV` here is the sanctioned exception to
 * "all environment access goes through config/env.ts" — Next evaluates this
 * file before the application runtime exists, and NODE_ENV is Next-managed.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers:
          process.env.NODE_ENV === "production"
            ? [
                ...securityHeaders,
                // HSTS only once TLS is terminated in production deployments.
                { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
              ]
            : securityHeaders,
      },
    ];
  },
};

export default nextConfig;
