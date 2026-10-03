"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface RemediationItem {
  id: string;
  actionType: string;
  title: string;
  description: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  problem: string;
  recommendation: string;
  status: string;
  autoExecutable: boolean;
  approvedById: string | null;
  approvedAt: string | null;
  executedAt: string | null;
  verifiedAt: string | null;
  rolledBackAt: string | null;
  evidence: Record<string, any>;
  rollbackPlan: {
    action?: string;
    description?: string;
    steps?: string[];
  };
  createdAt: string;
}

interface RemediationOverview {
  totalActions: number;
  pendingApprovalsCount: number;
  completedCount: number;
  rolledBackCount: number;
  verificationPassRatePct: number;
  recentActions: RemediationItem[];
}

export function RemediationView({ organizationId }: { organizationId: string }) {
  const [overview, setOverview] = useState<RemediationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingActionId, setActingActionId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/v1/organizations/${organizationId}/remediation`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to load remediation intelligence.");
        }
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          setOverview(body.data.overview);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, reloadTrigger]);

  async function handleApprove(actionId: string) {
    setActingActionId(actionId);
    setFeedbackMessage("Executing action and running post-fix verification probe...");

    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/remediation/${actionId}/approve`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to approve action.");

      setFeedbackMessage(
        body.data.status === "COMPLETED"
          ? "✓ Fix successfully applied and verified via synthetic probe!"
          : "⚠️ Action executed but verification failed — automated rollback triggered.",
      );
      setReloadTrigger((v) => v + 1);
      setTimeout(() => setFeedbackMessage(null), 5000);
    } catch (err: any) {
      alert(err.message);
      setFeedbackMessage(null);
    } finally {
      setActingActionId(null);
    }
  }

  async function handleRollback(actionId: string) {
    if (!confirm("Are you sure you want to revert this remediation back to its previous state?")) {
      return;
    }

    setActingActionId(actionId);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/remediation/${actionId}/rollback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Manual rollback requested by operator" }),
        },
      );
      if (!res.ok) throw new Error("Rollback failed.");

      setFeedbackMessage("✓ Changes successfully rolled back to pre-fix state.");
      setReloadTrigger((v) => v + 1);
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActingActionId(null);
    }
  }

  async function handleReject(actionId: string) {
    setActingActionId(actionId);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/remediation/${actionId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Rejected by operator" }),
        },
      );
      if (!res.ok) throw new Error("Failed to reject proposal.");
      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActingActionId(null);
    }
  }

  async function handleSimulateProposal() {
    setIsSimulating(true);
    try {
      const sampleActions = [
        {
          actionType: "DISABLE_WP_DEBUG",
          problem: "Production page exposed WP_DEBUG stack traces and SQL query diagnostics",
          evidence: { exposedFile: "wp-config.php", detectedString: "WP_DEBUG: true" },
        },
        {
          actionType: "UPDATE_WORDPRESS_CORE",
          problem: "WordPress core version is 3 minor releases behind critical security patch",
          evidence: { currentVersion: "6.4.1", targetVersion: "6.4.4", cveCount: 2 },
        },
        {
          actionType: "REMOVE_NOINDEX_HEADER",
          problem: "Accidental X-Robots-Tag: noindex header detected on key production route",
          evidence: { headerKey: "X-Robots-Tag", headerValue: "noindex, nofollow" },
        },
      ];

      const chosen = sampleActions[Math.floor(Math.random() * sampleActions.length)]!;

      const res = await fetch(`/api/v1/organizations/${organizationId}/remediation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chosen),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to generate proposal.");

      setReloadTrigger((v) => v + 1);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSimulating(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-on-surface-variant animate-pulse">
          <div className="h-4 w-4 rounded-full border-2 border-primary-container border-t-transparent animate-spin" />
          <span>Initializing AutoFix remediation pipeline...</span>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <GlassCard className="p-8 text-center" glow="rose">
        <h3 className="text-lg font-semibold text-status-outage">Remediation Pipeline Error</h3>
        <p className="mt-2 text-sm text-on-surface-variant">{error}</p>
        <button
          onClick={() => setReloadTrigger((v) => v + 1)}
          className="mt-4 px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg bg-surface-container-high border border-glass-specular-border hover:bg-surface-container-highest transition-colors"
        >
          Retry
        </button>
      </GlassCard>
    );
  }

  const actions = overview?.recentActions || [];
  const pendingActions = actions.filter((a) => a.status === "PENDING_APPROVAL");
  const pastActions = actions.filter((a) => a.status !== "PENDING_APPROVAL");

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-on-surface">
            Automated Remediation & AutoFix Engine
          </h2>
          <p className="text-sm text-on-surface-variant">
            Safe 8-step remediation pipeline with strict operator approval controls and automated rollback protection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSimulateProposal}
            disabled={isSimulating}
            className="flex items-center gap-2 rounded-xl border border-glass-specular-border bg-surface-container-low/75 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {isSimulating ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
            ) : (
              <span>🛠️</span>
            )}
            Simulate Fix Proposal
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-200">
          <span>🛡️</span>
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard className="p-5" glow={pendingActions.length > 0 ? "rose" : "cyan"}>
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Pending Approvals</span>
            <span className="font-mono text-amber-400">OPERATOR QUEUE</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.pendingApprovalsCount ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">actions</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {pendingActions.length > 0
              ? "Requires explicit authorization prior to execution"
              : "All remediation proposals reviewed"}
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="emerald">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Remediated Issues</span>
            <span className="font-mono text-emerald-400">RESOLVED</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.completedCount ?? 0}
            </span>
            <span className="text-xs text-on-surface-variant">issues fixed</span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Verified healthy by post-fix synthetic probes
          </p>
        </GlassCard>

        <GlassCard className="p-5" glow="violet">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Verification Pass Rate</span>
            <span className="font-mono text-purple-400">INTEGRITY</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-on-surface">
              {overview?.verificationPassRatePct ?? 100}%
            </span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            {overview?.rolledBackCount ?? 0} auto-rollbacks triggered on probe mismatch
          </p>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Safety Invariant</span>
            <span className="font-mono text-blue-400">PRD §17</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-tight text-emerald-400">
              Guaranteed Rollback
            </span>
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            High-risk operations never run automatically without explicit authorization
          </p>
        </GlassCard>
      </div>

      {/* Pending Approvals Queue */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-on-surface">
              Pending Authorization Queue
            </h3>
            <p className="text-xs text-on-surface-variant">
              High and medium risk remediations staged for operator review and approval
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container-high border border-glass-specular-border text-on-surface-variant">
            {pendingActions.length} Pending
          </span>
        </div>

        {pendingActions.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant">
            <p className="text-sm">Zero pending remediation approvals.</p>
            <p className="text-xs mt-1">
              Click <strong className="text-on-surface">"Simulate Fix Proposal"</strong> to test the 8-step pipeline with sample data.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingActions.map((action) => {
              const isActing = actingActionId === action.id;
              const riskColor =
                action.riskLevel === "HIGH"
                  ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  : action.riskLevel === "MEDIUM"
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";

              return (
                <div
                  key={action.id}
                  className="rounded-xl border border-glass-specular-border bg-surface-container-high/40 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-on-surface">{action.title}</strong>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${riskColor}`}
                      >
                        {action.riskLevel} RISK
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      Staged {new Date(action.createdAt).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* 8-Step Pipeline Visual Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-surface-container-low/75 p-3 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                        1. Problem & Trigger
                      </span>
                      <p className="text-on-surface">{action.problem}</p>
                    </div>

                    <div className="rounded-lg bg-surface-container-low/75 p-3 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                        2. Recommended Fix
                      </span>
                      <p className="text-on-surface">{action.recommendation}</p>
                    </div>

                    <div className="rounded-lg bg-surface-container-low/75 p-3 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant">
                        3. Rollback Plan
                      </span>
                      <p className="text-cyan-300 font-mono text-[11px]">
                        {action.rollbackPlan?.description || "Automated state restoration snapshot"}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => handleReject(action.id)}
                      disabled={isActing}
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high border border-glass-specular-border text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(action.id)}
                      disabled={isActing}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary-container text-xs font-semibold text-on-primary-container shadow-md shadow-primary-container/20 hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isActing ? (
                        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <span>✓</span>
                      )}
                      Approve & Execute (with Rollback Protection)
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* Execution & Audit History Log */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-on-surface">
              Execution & Audit Trail History
            </h3>
            <p className="text-xs text-on-surface-variant">
              Immutable record of executed remediations, verification checks, and rollback operations
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-surface-container-high border border-glass-specular-border text-on-surface-variant">
            {pastActions.length} Executed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-glass-specular-border text-on-surface-variant">
                <th className="pb-3 font-semibold uppercase tracking-wider">Remediation Action</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Risk Level</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Executed At</th>
                <th className="pb-3 font-semibold uppercase tracking-wider">Verification</th>
                <th className="pb-3 font-semibold uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-specular-border">
              {pastActions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                    No historical remediation records found.
                  </td>
                </tr>
              ) : (
                pastActions.map((action) => {
                  const statusColor =
                    action.status === "COMPLETED"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : action.status === "ROLLED_BACK"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      : "bg-surface-container-high text-on-surface-variant border border-glass-specular-border";

                  return (
                    <tr key={action.id} className="hover:bg-surface-container-high/40 transition-colors">
                      <td className="py-4">
                        <div className="space-y-0.5">
                          <strong className="text-sm text-on-surface">{action.title}</strong>
                          <div className="text-[11px] font-mono text-on-surface-variant">
                            {action.actionType}
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusColor}`}
                        >
                          {action.status}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className="font-mono text-xs">{action.riskLevel}</span>
                      </td>
                      <td className="py-4 font-mono text-on-surface-variant">
                        {action.executedAt
                          ? new Date(action.executedAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="py-4">
                        {action.status === "COMPLETED" ? (
                          <span className="text-emerald-400 font-semibold">✓ Verified Healthy</span>
                        ) : action.status === "ROLLED_BACK" ? (
                          <span className="text-amber-400 font-semibold">⚠️ Auto-Rolled Back</span>
                        ) : (
                          <span className="text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        {action.status === "COMPLETED" && (
                          <button
                            onClick={() => handleRollback(action.id)}
                            className="px-2.5 py-1 rounded-lg bg-surface-container-high border border-glass-specular-border text-[11px] font-medium text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition-colors"
                          >
                            Rollback
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
