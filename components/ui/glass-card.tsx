import React from "react";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "interactive";
  glow?: "cyan" | "violet" | "emerald" | "rose" | "none";
  className?: string;
  children: React.ReactNode;
}

export function GlassCard({
  variant = "default",
  glow = "none",
  className = "",
  children,
  ...props
}: GlassCardProps) {
  const baseClasses =
    "relative overflow-hidden rounded-2xl border transition-all duration-200";

  const variantClasses = {
    default:
      "bg-surface-container-low/75 backdrop-blur-2xl border-glass-specular-border shadow-[0_12px_36px_rgba(0,0,0,0.45)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]",
    elevated:
      "bg-surface-container-high/80 backdrop-blur-3xl border-glass-specular-border shadow-[0_20px_50px_rgba(0,0,0,0.55)] shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)]",
    interactive:
      "bg-surface-container-low/75 backdrop-blur-2xl border-glass-specular-border shadow-[0_12px_36px_rgba(0,0,0,0.45)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] hover:border-primary-container/40 hover:shadow-[0_16px_44px_rgba(0,240,255,0.15)] hover:scale-[1.005] cursor-pointer",
  }[variant];

  const glowOverlays = {
    cyan: "before:absolute before:-top-20 before:-right-20 before:w-48 before:h-48 before:bg-primary-container/10 before:rounded-full before:blur-3xl before:pointer-events-none",
    violet: "before:absolute before:-top-20 before:-right-20 before:w-48 before:h-48 before:bg-secondary-container/20 before:rounded-full before:blur-3xl before:pointer-events-none",
    emerald: "before:absolute before:-top-20 before:-right-20 before:w-48 before:h-48 before:bg-status-operational/15 before:rounded-full before:blur-3xl before:pointer-events-none",
    rose: "before:absolute before:-top-20 before:-right-20 before:w-48 before:h-48 before:bg-status-outage/15 before:rounded-full before:blur-3xl before:pointer-events-none",
    none: "",
  }[glow];

  return (
    <div
      className={`${baseClasses} ${variantClasses} ${glowOverlays} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
