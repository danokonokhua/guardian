import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Guardian",
    template: "%s | Guardian",
  },
  description:
    "Digital Business Guardian — AI-powered digital business operations platform (foundation phase).",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-surface-base text-text-primary antialiased">{children}</body>
    </html>
  );
}
