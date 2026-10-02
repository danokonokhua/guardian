import React from "react";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "glass" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function GlassButton({
  variant = "glass",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: GlassButtonProps) {
  const sizeClasses = {
    sm: "px-3.5 py-1.5 text-xs gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3.5 text-base gap-2.5",
  }[size];

  const variantClasses = {
    primary:
      "bg-primary-container hover:brightness-110 text-on-primary-container font-semibold shadow-[0_0_24px_rgba(0,240,255,0.4)] border border-primary/30",
    glass:
      "bg-surface-container-high/70 hover:bg-surface-container-highest/90 text-on-surface border border-glass-specular-border shadow-[0_8px_20px_rgba(0,0,0,0.35)] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]",
    destructive:
      "bg-status-outage/20 hover:bg-status-outage/30 text-status-outage border border-status-outage/40 shadow-[0_0_20px_rgba(244,63,94,0.25)]",
    ghost:
      "bg-transparent hover:bg-surface-container/60 text-on-surface-variant hover:text-on-surface border border-transparent",
  }[variant];

  return (
    <button
      className={`group relative inline-flex items-center justify-center rounded-full font-headline transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
