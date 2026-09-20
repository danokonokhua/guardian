import "./server-only-cli.cjs";

import { SECURITY_PROBE_PATHS } from "../lib/jobs/security-check";
import { requestSafeOutbound } from "../lib/security/outbound-url";

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const homepageOnly = rawArgs.includes("--homepage");
  const args = rawArgs.filter((arg) => arg !== "--homepage");
  if (args.length !== 1 || args[0] === "--help") {
    process.stdout.write(
      "Usage: security-probe-diagnostics.ts [--homepage] https://your-website.com\n",
    );
    if (args[0] !== "--help") process.exitCode = 2;
    return;
  }

  const target = new URL(args[0]!);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
    throw new Error("Supply an HTTP(S) website URL without credentials.");
  }

  if (homepageOnly) {
    const response = await requestSafeOutbound(new URL("/", target).toString(), {
      method: "GET",
      timeoutMs: 10_000,
      maxBodyBytes: 512 * 1024,
    });
    const html = await response.text();
    const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
    process.stdout.write(
      `${JSON.stringify(
        {
          status: response.status,
          title: title
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 200),
          verificationMessagePresent: /please wait while your request is being verified/i.test(
            html,
          ),
          bytes: Buffer.byteLength(html),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  process.stdout.write(`Sequential Guardian probes: ${target.origin}\n`);
  process.stdout.write("Redirects are not followed. Response bodies are not printed.\n");
  for (const { path } of SECURITY_PROBE_PATHS) {
    const started = performance.now();
    try {
      const response = await requestSafeOutbound(new URL(path, target).toString(), {
        method: "GET",
        timeoutMs: 10_000,
        maxBodyBytes: 8 * 1024,
      });
      process.stdout.write(
        `${path} | Status: ${response.status} | Time: ${Math.round(performance.now() - started)}ms\n`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      process.stdout.write(
        `${path} | ERROR: ${message} | Time: ${Math.round(performance.now() - started)}ms\n`,
      );
      process.exitCode = 1;
    }
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Diagnostic failed"}\n`);
  process.exitCode = 1;
});
