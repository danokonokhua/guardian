import React from "react";

export interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  wrapperClassName?: string;
}

export function GlassInput({
  icon,
  rightElement,
  className = "",
  wrapperClassName = "",
  ...props
}: GlassInputProps) {
  return (
    <div className={`relative flex items-center w-full ${wrapperClassName}`}>
      {icon && (
        <span className="absolute left-3.5 text-outline text-lg pointer-events-none transition-colors group-focus-within:text-primary-container">
          {icon}
        </span>
      )}
      <input
        className={`w-full min-h-[44px] rounded-xl bg-surface-container/60 backdrop-blur-md border border-glass-subtle-border px-4 py-2.5 text-sm text-on-surface placeholder:text-outline/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] transition-all duration-200 focus:outline-none focus:border-primary-container/60 focus:shadow-[0_0_16px_rgba(0,240,255,0.25)] ${
          icon ? "pl-10" : ""
        } ${rightElement ? "pr-12" : ""} ${className}`}
        {...props}
      />
      {rightElement && <div className="absolute right-3 flex items-center">{rightElement}</div>}
    </div>
  );
}
