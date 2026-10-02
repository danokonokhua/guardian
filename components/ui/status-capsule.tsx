import React from "react";

export type StatusType = "operational" | "degraded" | "outage" | "maintenance" | "healthy" | "warning" | "critical";

export interface StatusCapsuleProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusType;
  label?: string;
  pulse?: boolean;
  className?: string;
}

export function StatusCapsule({
  status,
  label,
  pulse = true,
  className = "",
  ...props
}: StatusCapsuleProps) {
  const normalizedStatus = ((): "operational" | "degraded" | "outage" | "maintenance" => {
    switch (status) {
      case "healthy":
      case "operational":
        return "operational";
      case "warning":
      case "degraded":
        return "degraded";
      case "critical":
      case "outage":
        return "outage";
      case "maintenance":
        return "maintenance";
      default:
        return "operational";
    }
  })();

  const beadColors = {
    operational: "bg-status-operational shadow-[0_0_8px_#10B981]",
    degraded: "bg-status-degraded shadow-[0_0_8px_#F59E0B]",
    outage: "bg-status-outage shadow-[0_0_8px_#F43F5E]",
    maintenance: "bg-status-maintenance shadow-[0_0_8px_#6366F1]",
  }[normalizedStatus];

  const textColors = {
    operational: "text-tertiary",
    degraded: "text-status-degraded",
    outage: "text-status-outage",
    maintenance: "text-secondary",
  }[normalizedStatus];

  const defaultLabels = {
    operational: "Operational",
    degraded: "Degraded",
    outage: "Outage",
    maintenance: "Maintenance",
  }[normalizedStatus];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high/70 backdrop-blur-md border border-glass-subtle-border shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.08)] font-label-code text-xs ${textColors} ${className}`}
      {...props}
    >
      <span
        className={`w-2 h-2 rounded-full ${beadColors} ${pulse ? "animate-pulse" : ""}`}
      />
      <span>{label ?? defaultLabels}</span>
    </span>
  );
}
