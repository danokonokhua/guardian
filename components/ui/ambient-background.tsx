import React from "react";

export interface AmbientBackgroundProps {
  variant?: "dashboard" | "audit" | "minimal";
  className?: string;
}

export function AmbientBackground({
  variant = "dashboard",
  className = "",
}: AmbientBackgroundProps) {
  return (
    <div
      className={`fixed inset-0 pointer-events-none overflow-hidden z-0 ${className}`}
      aria-hidden="true"
    >
      {variant === "dashboard" && (
        <>
          <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-primary-fixed-dim/10 rounded-full blur-[140px]" />
          <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] bg-secondary-container/15 rounded-full blur-[160px]" />
          <div className="absolute bottom-0 right-10 w-[600px] h-[600px] bg-status-operational/5 rounded-full blur-[180px]" />
        </>
      )}
      {variant === "audit" && (
        <>
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-primary-container/12 rounded-full blur-[150px]" />
          <div className="absolute top-1/3 -right-20 w-[450px] h-[450px] bg-secondary-container/20 rounded-full blur-[160px]" />
          <div className="absolute bottom-10 left-10 w-[550px] h-[550px] bg-status-operational/8 rounded-full blur-[170px]" />
        </>
      )}
      {variant === "minimal" && (
        <>
          <div className="absolute -top-40 left-1/3 w-[500px] h-[500px] bg-primary-fixed-dim/8 rounded-full blur-[140px]" />
        </>
      )}
    </div>
  );
}
