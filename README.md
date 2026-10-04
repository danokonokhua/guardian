# 🛡️ Guardian

**Autonomous Digital Operations Platform & AI Chief Operating Officer (AI COO)**

Guardian is an enterprise-grade digital business operations platform designed for business owners, MSPs, digital agencies, and engineering teams. It bridges the gap between raw technical infrastructure telemetry and bottom-line executive impact by answering the questions that matter most:

> _"Is my digital business making money right now, where is it losing revenue, what is about to break, and what should I fix first?"_

Guardian moves businesses through six evolutionary maturity stages:  
**`MONITOR → DIAGNOSE → RECOMMEND → ACT → PREDICT → AI COO`**

---

## 🌟 What Guardian Does

Traditional monitoring tools (Pingdom, UptimeRobot, Datadog) alert engineers about server pings and HTTP status codes, but they lack business context. Guardian evaluates your entire digital presence across **8 core vectors**, calculates financial impact ($USD), predicts failures before they happen, and executes automated fixes.

### 1. 💰 Revenue & Conversion Funnel Protection

- **Critical Lead-Form Telemetry**: Watches inquiry forms, contact forms, checkout funnels, booking calendars, WhatsApp buttons, and telephone CTAs.
- **Silent Failure Detection**: Detects broken form scripts, missing submission endpoints, and failed transactions before customer complaints arise.
- **Estimated Revenue at Risk**: Translates downtime and form failures into estimated monetary loss based on traffic and average order/lead value.

### 2. 🌐 Multi-Vector Uptime & Infrastructure Probing

- **High-Frequency Synthetic Probing**: Sub-minute uptime monitoring with global response time measurement and TLS validation.
- **SSL Runway & Certificate Monitoring**: Tracks certificate validity, chain health, and days remaining with automated renewal countdowns.
- **DNS Health & Baseline Drift Detection**: Continuous validation of authoritative nameservers, A/AAAA records, MX, and TXT configurations.
- **Domain Expiry Sentinel**: WHOIS tracking that alerts teams months and weeks before domain registrations expire.

### 3. 📊 Holistic Digital Health Score (6-Vector Weighted Model)

Guardian compiles an explainable 0–100 Digital Health Score updated in real time:

- **25% Website & Uptime**: Availability, response latency, TLS/SSL handshake health.
- **25% Lead Generation & Revenue**: Form integrity, checkout accessibility, conversion CTA responsiveness.
- **15% Performance & Core Web Vitals**: LCP, FID/INP, CLS, TTFB, and mobile experience metrics.
- **15% SEO Intelligence**: Technical SEO, meta tags, sitemap availability, robots.txt validity, and indexability.
- **10% Security Posture**: Security headers (HSTS, CSP, X-Frame-Options), outdated CMS/plugin signatures, vulnerability scans.
- **10% Reputation & Reviews**: Google Business Profile reviews, customer sentiment analysis, and rating trends.

### 4. ⚡ Autonomous Remediation (AutoFix Engine)

- **1-Click & Autonomous Healing**: Automatically remediates common operational issues without human intervention.
- **Pre-Built Action Catalog**:
  - Cloudflare & edge cache purges
  - Dynamic DNS failover
  - SSL certificate renewal triggers
  - Missing robots.txt generation
  - WordPress plugin and core vulnerability patching
- **Safety Rollbacks**: Every remediation action maintains execution state, allowing immediate 1-click rollbacks if verification checks fail.

### 5. 🔮 Predictive Intelligence & Failure Forecasting

- **Proactive Runway Modeling**: Identifies degradations before they cause customer-facing downtime.
- **6 Predictive Vectors**:
  - _SSL Expiration Runway_: Predicts the exact hour of certificate failure.
  - _Latency Acceleration_: Detects resource saturation and database latency creep.
  - _Conversion Funnel Collapse_: Identifies abnormal drops in lead submission velocity.
  - _SEO Visibility Decay_: Flags rapid drops in indexed pages or crawl errors.
  - _Security Posture Degradation_: Tracks vulnerability exposure trajectories.
  - _Reputation Velocity Slopes_: Early-warning alerts for negative customer review clusters.

### 6. 🧠 AI COO (Executive Operations Directives)

- **Autonomous Cross-Domain Synthesis**: The AI Chief Operating Officer digests telemetry across all 8 vectors to produce high-level strategic directives.
- **Prioritized Action Tiers**: Categorizes actions into `P0_IMMEDIATE`, `P1_THIS_WEEK`, `P2_THIS_MONTH`, and `P3_STRATEGIC`.
- **Quantified Business Impact**: Associates every directive with estimated dollar value saved or unlocked ($USD), time-to-value, and cross-domain evidence trails.
- **1-Click Executive Execution**: Approve directives directly from the glassmorphic executive command center.

### 7. 🏢 Agency Multi-Tenancy & White-Label Portals

- **Tenant-Isolated Workspaces**: Complete multi-tenancy backed by PostgreSQL Row-Level Security (RLS).
- **White-Label Client Portals**: Custom branding, logos, color themes, and custom domains (`status.youragency.com`).
- **Bulk Client Audits**: Scan hundreds of client sites simultaneously to generate high-converting audit pitches.
- **Scheduled Executive Reports**: Automated weekly and monthly PDF/email health summaries delivered directly to stakeholders.

### 8. 🔌 Marketplace & Ecosystem Integrations

- **Curated Integration Catalog**:
  - **ChatOps & Alerts**: Slack, Discord, Microsoft Teams, PagerDuty
  - **Observability**: Datadog, Cloudflare
  - **Developer Tools**: GitHub, Signed Webhooks
- **Google Suite Deep Integration**: Direct OAuth 2.0 connectors for Google Analytics 4 (GA4), Google Search Console (GSC), and Google Business Profile (GBP).
- **WordPress Plugin & REST Connector**: Bi-directional communication with WordPress sites to inspect plugins, themes, updates, and execute remote patches.
- **Hardware-Level Encryption**: All third-party secrets and tokens are encrypted at rest using AES-256-GCM with tenant-bound Associated Authenticated Data (AAD).

### 9. 📱 Mobile Command Center & PWA

- **Installable Progressive Web App (PWA)**: Standalone native app experience on iOS and Android.
- **Web Push Notifications (RFC 8291 / RFC 8292)**: Hardware-encrypted instant push alerts delivered to operators' devices even when the browser is closed.
- **Sticky Mobile Command Bar**: Fast, touch-optimized triage on phones and tablets.

### 10. 🔑 Public Developer API & Extensibility

- **RESTful API v1**: Complete programmatic access to organizations, websites, health scores, issues, remediation, and telemetry.
- **API Key Security**: High-entropy keys hashed with SHA-256; keys are never stored in plaintext.
- **Sliding Window Rate Limiting**: Redis/in-memory rate limiting with RFC-compliant headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`).
- **OpenAPI 3.1 Spec**: Machine-readable interactive specification available at `/api/v1/openapi.json`.

---

## 📖 How to Use Guardian (Step-by-Step User Guide)

Whether you are a solo business owner, an MSP engineer, or an agency managing dozens of client domains, Guardian provides an intuitive workflow from initial discovery to autonomous operations:

### 1. Account Setup & Initial Onboarding

1. **Register**: Go to [`/signup`](http://localhost:3000/signup) to create your primary organization owner account (or [`/login`](http://localhost:3000/login) to sign in).
2. **Add Your First Website**: Navigate to **Websites** and enter your target URL (e.g. `https://mybusiness.com`).
3. **Automated Discovery**: Guardian instantly provisions and schedules background telemetry probes:
   - Synthetic HTTP/HTTPS availability & response latency.
   - SSL certificate runway & chain validation.
   - DNS authoritative baseline drift.
   - Technical SEO (meta tags, robots.txt, sitemaps).
   - Core Web Vitals & basic security posture.
4. **Tag Revenue & Lead CTAs**: In website settings, specify the CSS selectors or endpoints for your primary lead generation mechanisms (contact forms, checkout buttons, booking calendars, WhatsApp CTAs, or phone links).

### 2. Daily Monitoring & Health Assessment

- **Executive Pulse (`/dashboard`)**: Check your aggregate **Digital Health Score (0–100)**, active critical incidents, revenue-at-risk, and real-time uptime status.
- **Digital Health Breakdown (`/health`)**: Inspect the 6 weighted vectors:
  - _Website & Uptime_ (25%)
  - _Lead Generation & Revenue_ (25%)
  - _Performance & Core Web Vitals_ (15%)
  - _SEO Intelligence_ (15%)
  - _Security Posture_ (10%)
  - _Reputation & Reviews_ (10%)
- **Revenue Protection Hub (`/revenue`)**: Verify that lead forms are actively receiving submissions and no silent script errors or 5xx submission failures are occurring.
- **Incident Command Center (`/issues`)**: Triage issues by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), view SLA breach countdown timers, and track Mean Time to Recovery (MTTR).

### 3. Resolving Issues with AutoFix Remediation (`/remediation`)

1. Navigate to [`/remediation`](http://localhost:3000/remediation) or open the **AutoFix** tab on any active issue.
2. Review the recommended remediation plan (e.g. DNS failover, Cloudflare cache purge, SSL renewal trigger, robots.txt restoration, or WordPress vulnerability patch).
3. Click **"Approve & Execute"**: Guardian dispatches the action with execution verification logs.
4. **Safety Net**: If needed, click **"Rollback"** to instantly revert the action to the previous state snapshot.

### 4. Strategic Operations with the AI COO (`/coo`)

1. Navigate to [`/coo`](http://localhost:3000/coo) to review the **Executive Operations Briefing**.
2. Guardian synthesizes multi-vector signals into actionable directives prioritized into:
   - `P0_IMMEDIATE` — Critical risks costing money right now.
   - `P1_THIS_WEEK` — High-priority performance, SEO, or security bottlenecks.
   - `P2_THIS_MONTH` — Strategic operational optimizations.
   - `P3_STRATEGIC` — Long-term competitive positioning.
3. Inspect the estimated **Business Impact ($USD)** and click **"Execute"** to initiate cross-system improvements.

### 5. Failure Prevention with Predictive Intelligence (`/predictive`)

1. Open [`/predictive`](http://localhost:3000/predictive) to view runway forecasts.
2. Check predictive risk meters for:
   - Certificate expiration runway (days remaining before browser warnings).
   - Latency acceleration slopes (predicting server saturation before crashes).
   - Conversion velocity drops (early warning of lead capture decay).
3. Implement preventive actions before customer-facing disruptions occur.

### 6. Connecting Integrations & Ecosystem (`/marketplace` & `/integrations`)

- **Team Alerts**: Go to [`/marketplace`](http://localhost:3000/marketplace) and install connectors for Slack, Discord, Microsoft Teams, PagerDuty, or Datadog.
- **Google Intelligence**: Connect Google Search Console, Google Analytics 4, and Google Business Profile under `/integrations` to sync search rankings, organic traffic, and customer reviews.
- **WordPress Bridge**: Pair your WordPress site by generating a secure pairing token to monitor plugins, themes, and core updates remotely.

### 7. Agency Portfolio & Client Management (`/agency`)

- **Client Organization Management**: Manage multiple client brands within isolated workspaces with PostgreSQL Row-Level Security (RLS).
- **White-Label Client Status Pages (`/status-pages`)**: Create publicly accessible or password-protected status pages with agency branding and custom domain mapping (`status.youragency.com`).
- **Executive PDF Reports**: Schedule automated weekly and monthly health digests dispatched directly to client executives.

### 8. Mobile Command & Instant Push Alerts (`/mobile`)

1. Open Guardian on your mobile device (iOS Safari or Android Chrome) and navigate to [`/mobile`](http://localhost:3000/mobile).
2. Tap **"Add to Home Screen"** to install the standalone Progressive Web App (PWA).
3. Tap **"Enable Push Notifications"** to receive instant hardware-encrypted alerts (RFC 8291 / 8292) when critical incidents occur.
4. Use the sticky mobile bottom navigation for 1-tap incident triage on the go.

### 9. Developer API & CLI Automation (`/developer`)

- **API Keys**: Generate scoped API keys under [`/developer`](http://localhost:3000/developer) with SHA-256 security.
- **REST Endpoints**: Ingest health metrics, manage websites, or trigger remediation via `/api/v1/organizations/{orgId}/...`.
- **OpenAPI Documentation**: Access the complete OpenAPI 3.1 specification at [`/api/v1/openapi.json`](http://localhost:3000/api/v1/openapi.json).

### 10. Instant Public Website Audit (`/audit`)

- **Web Audit**: Visit [`/audit`](http://localhost:3000/audit) for a free, unauthenticated diagnostic audit of any public website URL.
- **CLI Audit**: Run instant multi-vector audits directly from your terminal:
  ```bash
  npm run audit:validate -- https://example.com --detailed
  ```

---

## 🛠️ Technology Stack

| Layer               | Technology                        | Description                                    |
| ------------------- | --------------------------------- | ---------------------------------------------- |
| **Framework**       | Next.js 16 (App Router)           | Modern React Server Components & API routes    |
| **Frontend**        | React 19 + Tailwind CSS v4        | High-performance, glassmorphic UI              |
| **Language**        | TypeScript (Strict Mode)          | 100% type safety across full stack             |
| **Database**        | PostgreSQL 16+ with RLS           | Multi-tenant Row-Level Security isolation      |
| **ORM**             | Prisma Client v6                  | Type-safe database queries and migrations      |
| **Background Jobs** | pg-boss v12                       | Transactional background job queue in Postgres |
| **Testing**         | Vitest + Testing Library          | 140+ test files, 880+ unit and route tests     |
| **Code Quality**    | ESLint 9 (Flat Config) + Prettier | Zero-tolerance lint and formatting standard    |

---

## 🚀 Quickstart & Development

### Prerequisites

- **Node.js**: `≥ 22.13.0`
- **npm**: `≥ 10.0.0`
- **PostgreSQL**: `≥ 16.0`

### 1. Clone & Install

```bash
git clone https://github.com/danokonokhua/guardian.git
cd guardian
npm ci
```

### 2. Configure Environment

Copy the environment template and configure your local PostgreSQL database:

```bash
cp .env.example .env
```

Key environment variables:

```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/guardian?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/guardian?schema=public"
APP_ENV="development"
LOG_LEVEL="info"
```

### 3. Initialize Database

```bash
# Generate Prisma Client
npm run db:generate

# Apply database migrations
npm run db:migrate

# Bootstrap the initial owner account & tenant
npm run auth:bootstrap
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the Guardian dashboard.

---

## 🧪 Testing & Verification

Guardian maintains 100% test pass rates and strict quality gates across every commit:

```bash
# Run the complete Vitest test suite (880+ tests)
npm test

# Run TypeScript strict type verification
npm run typecheck

# Run ESLint across the entire codebase
npm run lint

# Check code formatting with Prettier
npm run format:check

# Execute production build
npm run build -- --webpack

# Test the Free Public Audit Engine against live sites
npm run audit:validate -- https://example.com --detailed
```

---

## 🗺️ Product Roadmap: All 27 Phases Delivered (100% Complete)

| Phase  | Milestone                         | Description                                                          |   Status    |
| :----: | --------------------------------- | -------------------------------------------------------------------- | :---------: |
| **1**  | Architecture & Tenancy Foundation | Multi-tenant PostgreSQL schema, RLS, auth, session management        | ✅ Complete |
| **2**  | Telemetry & Synthetic Probing     | High-frequency HTTP, HTTPS, latency, and status monitoring           | ✅ Complete |
| **3**  | Digital Health Score Engine       | 6-vector weighted scoring model (0–100) with historical logs         | ✅ Complete |
| **4**  | Real-Time Notification Engine     | Multi-channel alert dispatch (Email, SMTP, Webhooks)                 | ✅ Complete |
| **5**  | Issue Tracking & Escalations      | Lifecycle management, deduplication, SLA breaches, triage            | ✅ Complete |
| **6**  | Revenue & Lead Protection         | Contact form probing, checkout funnel, WhatsApp/phone CTA checks     | ✅ Complete |
| **7**  | Free Public Audit Engine          | Instant unauthenticated website diagnostic engine at `/audit`        | ✅ Complete |
| **8**  | Billing & Stripe Subscriptions    | Plan entitlements (Free, Pro, Agency, Enterprise), Stripe billing    | ✅ Complete |
| **9**  | Google Business & Reputation      | Google Business Profile integration, review scraping, AI replies     | ✅ Complete |
| **10** | Competitive Intelligence          | Competitor benchmarking, SERP tracking, and marketing parity         | ✅ Complete |
| **11** | Agency & White-Label Portals      | White-label client dashboards, custom domains, bulk site audits      | ✅ Complete |
| **12** | Core Web Vitals & CWV Scans       | Google PageSpeed & Lighthouse metrics (LCP, FID/INP, CLS)            | ✅ Complete |
| **13** | SSL, DNS & Domain Runway          | SSL expiration tracking, DNS drift baselining, WHOIS expiry          | ✅ Complete |
| **14** | Accessibility (WCAG 2.1 AA)       | Automated accessibility compliance scans and issue detection         | ✅ Complete |
| **15** | Email Deliverability Health       | SPF, DKIM, and DMARC policy validation and DNS record health         | ✅ Complete |
| **16** | WordPress Deep Integration        | WordPress REST API bridge, plugin/theme vulnerability analysis       | ✅ Complete |
| **17** | Autonomous AutoFix Remediation    | 1-click & autonomous remediation with instant rollback safety        | ✅ Complete |
| **18** | Incident Command & SLA Metrics    | Real-time incident response center, MTTR and SLA tracking            | ✅ Complete |
| **19** | Scheduled Executive Reports       | Automated weekly and monthly PDF/email business health briefs        | ✅ Complete |
| **20** | Status Pages Platform             | Public and private status pages with custom slugs and incident feeds | ✅ Complete |
| **21** | Security Posture Scanner          | Security header audits, CMS signature checks, vulnerability triage   | ✅ Complete |
| **22** | AI Guardian Diagnostics           | Root-cause analysis, automated diagnosis, and recovery playbooks     | ✅ Complete |
| **23** | Developer API Platform            | Public REST API v1, SHA-256 API keys, sliding-window rate limiting   | ✅ Complete |
| **24** | Mobile Command & PWA              | Progressive Web App, RFC 8291/8292 Web Push notifications            | ✅ Complete |
| **25** | Marketplace Platform              | 8 enterprise plugins (Slack, Teams, Discord, PagerDuty, etc.)        | ✅ Complete |
| **26** | Predictive Intelligence           | Runway decay models, anomaly forecasting, failure prevention         | ✅ Complete |
| **27** | AI COO Operations Platform        | Cross-domain executive directives, $USD impact, 1-click execution    | ✅ Complete |

---

## 🔒 Security & Privacy

- **Row-Level Security (RLS)**: Enforced at the PostgreSQL connection level (`app.org_id`), guaranteeing strict multi-tenant data isolation.
- **Hardware-Level Encryption**: Third-party integration credentials and API tokens are encrypted using AES-256-GCM.
- **Zero Raw Secrets**: API keys, session tokens, and passwords are only stored as cryptographically salted hashes.
- **Sanitized Logging**: All system logs are automatically scrubbed of credentials, passwords, session tokens, and authorization headers.

---

## 📄 License

Guardian is proprietary software. All rights reserved.
