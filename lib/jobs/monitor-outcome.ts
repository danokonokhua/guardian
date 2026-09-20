import type { IssueSeverity } from "@prisma/client";

export type MonitorCheckOutcome = {
  status: "UP" | "DOWN" | "ERROR";
  healthy: boolean;
  responseTimeMs: number;
  httpStatusCode?: number;
  errorMessage?: string;
  details: Record<string, string | number>;
  finding: {
    ruleId: string;
    severity: IssueSeverity;
    title: string;
    summary: string;
    businessImpact?: string;
    /** 0–1 confidence that the stated business impact is supported by evidence. */
    impactConfidence?: number;
    recommendedAction?: string;
  };
};
