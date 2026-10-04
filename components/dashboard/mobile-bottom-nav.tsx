"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/health", label: "Health", icon: "🛡️" },
  { href: "/revenue", label: "Revenue", icon: "💰" },
  { href: "/remediation", label: "AutoFix", icon: "⚡" },
  { href: "/mobile", label: "Mobile", icon: "📱" },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-surface-container/90 backdrop-blur-xl border-t border-glass-subtle-border px-3 py-2 flex items-center justify-around shadow-2xl"
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition-all rounded-xl ${
              isActive
                ? "text-cyan-400 font-semibold scale-105"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="text-lg leading-none mb-1">{item.icon}</span>
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
