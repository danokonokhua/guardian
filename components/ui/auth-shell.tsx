import type { ReactNode } from "react";
import { Brand } from "./brand";
export function AuthShell({ children, signup = false }: { children: ReactNode; signup?: boolean }) {
  return (
    <main className={"auth-shell" + (signup ? " auth-signup" : "")}>
      <header className="auth-header">
        <Brand />
        <a href="/audit" className="quiet-link">
          Explore the free audit ↗
        </a>
      </header>
      <div className="auth-layout">
        {signup && (
          <aside className="auth-story">
            <span className="eyebrow">VISIBILITY. CLARITY. CONFIDENCE.</span>
            <h2>
              Never let another
              <br />
              silent revenue leak
              <br />
              <em>go undetected.</em>
            </h2>
            <p>
              Your website, lead forms, and digital health. Bring the signals that matter into one
              place.
            </p>
            <div className="story-card">
              <span className="eyebrow">YOUR OPERATIONS, CONNECTED</span>
              {[
                "Monitor website availability",
                "Find issues that affect enquiries",
                "Prioritize your next action",
              ].map((s, i) => (
                <div className="story-row" key={s}>
                  <span className="step-number">0{i + 1}</span>
                  {s}
                  <span aria-hidden="true">↗</span>
                </div>
              ))}
            </div>
            <p className="fine-print">From technical evidence to practical business decisions.</p>
          </aside>
        )}
        <section className="auth-card">{children}</section>
      </div>
      <footer className="auth-footer">
        Guardian · Digital business operations<span>Protect. Understand. Grow.</span>
      </footer>
    </main>
  );
}
