import "./server-only-cli.cjs";

import { parseValidationTargets } from "@/lib/audit/validation";
import { runFreeAudit } from "@/lib/audit/service";

type ValidationSummary = {
  url: string;
  score: number | null;
  scoreState: string;
  coverageWeight: number;
  criticalCount: number;
  warningCount: number;
  findings?: Array<{
    category: string;
    ruleId: string;
    severity: string;
    title: string;
    summary: string;
    httpStatusCode: number | null;
    responseTimeMs: number;
  }>;
  error?: string;
};

async function main(): Promise<void> {
  const detailed = process.argv.slice(2).includes("--detailed");
  const rawTargets = process.argv.slice(2).filter((argument) => argument !== "--detailed");
  let targets: string[];
  try {
    targets = parseValidationTargets(rawTargets);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Invalid validation targets."}\n`,
    );
    process.exitCode = 2;
    return;
  }

  const summaries: ValidationSummary[] = [];
  for (const url of targets) {
    try {
      const result = await runFreeAudit(url);
      summaries.push({
        url: result.url,
        score: result.score.score,
        scoreState: result.score.state,
        coverageWeight: result.score.coverageWeight,
        criticalCount: result.critical.length,
        warningCount: result.warnings.length,
        ...(detailed
          ? {
              findings: result.findings.map((finding) => ({
                category: finding.category,
                ruleId: finding.ruleId,
                severity: finding.severity,
                title: finding.title,
                summary: finding.summary,
                httpStatusCode: finding.httpStatusCode,
                responseTimeMs: finding.responseTimeMs,
              })),
            }
          : {}),
      });
    } catch (error) {
      summaries.push({
        url,
        score: null,
        scoreState: "ERROR",
        coverageWeight: 0,
        criticalCount: 0,
        warningCount: 0,
        error: error instanceof Error ? error.message.slice(0, 300) : "Audit failed.",
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify({ count: summaries.length, results: summaries }, null, 2)}\n`,
  );
  if (summaries.some((summary) => summary.error !== undefined)) process.exitCode = 1;
}

void main();
