import Link from "next/link";
import AuditForm from "@/app/audit/audit-form";
import { Brand } from "@/components/ui/brand";
import { AmbientBackground } from "@/components/ui/ambient-background";
const features = [
  {
    n: "01",
    title: "Protect your digital front door.",
    text: "Monitor uptime, SSL, broken links, and critical lead forms. Find the failures that can keep customers from reaching you.",
    tags: ["Website availability", "Lead-form checks"],
  },
  {
    n: "02",
    title: "Understand what needs attention.",
    text: "Turn monitoring results into an explainable health score, issue history, and grounded recommendations.",
    tags: ["Digital health score", "Prioritized issues"],
  },
  {
    n: "03",
    title: "Build on a healthier foundation.",
    text: "Check essential SEO, server response time, and security hygiene. Give your team a clear place to start improving.",
    tags: ["Basic SEO", "Security hygiene"],
  },
];
export default function HomePage() {
  return (
    <div className="marketing-page relative overflow-hidden">
      <AmbientBackground variant="audit" />
      <header className="public-header relative z-10">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#features" className="desktop-link">
            Platform
          </a>
          <Link href="/audit" className="desktop-link">
            Free audit
          </Link>
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="button-primary compact">
            Get started <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </header>
      <main id="main-content" className="relative z-10">
        <section className="hero">
          <span className="status-pill">
            <span /> DIGITAL BUSINESS OPERATIONS
          </span>
          <h1>
            Never let another
            <br />
            silent revenue leak
            <br />
            <em>go undetected.</em>
          </h1>
          <p>
            Your website can be online while your business is losing opportunities.
            <br className="desktop-link" /> Discover what is broken, understand the impact, and know
            what to fix next.
          </p>
          <div className="hero-actions">
            <a href="#free-audit" className="button-primary">
              Check my website <span aria-hidden="true">↗</span>
            </a>
            <Link href="/signup" className="button-secondary">
              Create your workspace
            </Link>
          </div>
          <div className="hero-details">
            <span>Website monitoring</span>
            <span>Lead-form health</span>
            <span>Actionable insights</span>
          </div>
        </section>
        <section className="audit-preview section-width" id="free-audit">
          <div className="panel-heading">
            <span className="eyebrow">YOUR FIRST HEALTH CHECK</span>
            <span className="status-pill">NO ACCOUNT REQUIRED</span>
          </div>
          <div className="audit-intro">
            <span className="scan-symbol" aria-hidden="true">
              ◎
            </span>
            <div>
              <h2>Is your digital business actually working?</h2>
              <p>
                Start with a free website audit. Get a snapshot of availability, response time,
                basic SEO, and security.
              </p>
            </div>
          </div>
          <AuditForm />
          <p className="fine-print">
            A real snapshot of your public website. Results show what was measured and where
            coverage is limited.
          </p>
          <div className="coverage-strip">
            <span>01 / AVAILABILITY</span>
            <span>02 / RESPONSE TIME</span>
            <span>03 / SEO BASICS</span>
            <span>04 / SECURITY</span>
          </div>
        </section>
        <section className="features section-width" id="features">
          <span className="eyebrow">PROTECT · UNDERSTAND · GROW</span>
          <h2>
            Clarity for the systems
            <br />
            your business depends on.
          </h2>
          <p className="section-description">
            Less guesswork. More visibility into what needs your attention.
          </p>
          <div className="feature-grid">
            {features.map((f) => (
              <article className="feature-card" key={f.n}>
                <span className="feature-number">{f.n} / GUARDIAN</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <div className="feature-tags">
                  {f.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="workflow section-width">
          <div>
            <span className="eyebrow">FROM SIGNAL TO NEXT STEP</span>
            <h2>
              A clearer path
              <br />
              from issue to action.
            </h2>
            <p>
              See the evidence behind each finding, understand its business impact, and prioritize
              what your team should address.
            </p>
            <Link href="/signup" className="quiet-link">
              Bring your operations together ↗
            </Link>
          </div>
          <ol>
            {["Monitor your website", "Understand the findings", "Prioritize your next action"].map(
              (s, i) => (
                <li key={s}>
                  <span className="step-number">0{i + 1}</span>
                  <span>{s}</span>
                  <span aria-hidden="true">↗</span>
                </li>
              ),
            )}
          </ol>
        </section>
        <section className="closing-cta section-width">
          <span className="eyebrow">YOUR BUSINESS DESERVES VISIBILITY</span>
          <h2>
            Stop guessing.
            <br />
            Start understanding.
          </h2>
          <p>Your first website health check is a good place to start.</p>
          <Link href="/audit" className="button-primary">
            Run a free audit ↗
          </Link>
        </section>
      </main>
      <footer className="public-footer section-width">
        <Brand />
        <p>Protect. Understand. Grow.</p>
        <Link href="/login">Sign in to your workspace ↗</Link>
      </footer>
    </div>
  );
}
