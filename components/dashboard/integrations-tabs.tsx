"use client";

import { useState } from "react";
import { GoogleIntegrationsView } from "./google-integrations-view";
import { WordpressIntegrationView } from "./wordpress-integration-view";

export function IntegrationsTabs({ organizationId }: { organizationId: string }) {
  const [activeTab, setActiveTab] = useState<"google" | "wordpress">("google");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setActiveTab("google")}
          className={`pb-3 px-4 text-sm font-semibold transition-colors relative ${
            activeTab === "google"
              ? "text-emerald-400 border-b-2 border-emerald-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Google Intelligence
        </button>
        <button
          onClick={() => setActiveTab("wordpress")}
          className={`pb-3 px-4 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
            activeTab === "wordpress"
              ? "text-cyan-400 border-b-2 border-cyan-400"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>WordPress Connect</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Phase 17
          </span>
        </button>
      </div>

      {activeTab === "google" ? (
        <GoogleIntegrationsView key={`google-${organizationId}`} organizationId={organizationId} />
      ) : (
        <WordpressIntegrationView key={`wp-${organizationId}`} organizationId={organizationId} />
      )}
    </div>
  );
}
