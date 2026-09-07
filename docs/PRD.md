# Guardian — Master Product Requirements

**Version:** 2.0  
**Status:** Canonical project product requirements  
**Category:** AI Digital Business Operations Platform  
**Target sequence:** SMBs → agencies → enterprise  
**Long-term vision:** AI Digital Operations Manager / AI COO

> This repository copy is the working canonical reference for product decisions. The source document is `Guardian_Master_PRD.pdf`, supplied by the project owner. Product requirements in this file govern scope and sequencing; engineering constraints are recorded separately in [`ENGINEERING_SPEC.md`](./ENGINEERING_SPEC.md).

## 1. Executive summary

Guardian is an AI-powered digital business operations platform that continuously monitors the digital systems contributing to a company’s revenue.

Guardian identifies broken systems, lost-lead opportunities, performance problems, SEO problems, security risks, conversion problems, reputation problems, marketing inefficiencies, and competitive opportunities. It translates those findings into:

**Business impact → Priority → Recommendation → Action**

The platform progressively evolves from a monitoring system into an AI-powered digital operations manager.

## 2. Fundamental problem

Modern businesses depend on many digital systems: websites, forms, WhatsApp, email, payments, CRM, Google, SEO, ads, analytics, reviews, social media, landing pages, WordPress, and hosting. Owners lack one place that answers: **“Is my digital business actually working?”**

## 3. Big idea

Guardian must go beyond “your website is down.” It should explain the business consequence, for example: an enquiry system has failed for four hours, affects high-traffic pages, and may prevent potential customers from contacting the business.

## 4. Product positioning

**Category:** AI Digital Business Operations Platform

**Positioning:** Guardian continuously monitors the digital systems that generate revenue, identifies what is broken or underperforming, explains the business impact, and recommends what to do next.

**Long-term statement:** Guardian protects, improves, and grows the digital business.

## 5. Target market

- Initial market: SMBs
- First test vertical: real estate
- Expansion: healthcare, legal, hospitality, education, solar, automotive, professional services, e-commerce, and agencies

## 6. Core product pillars

1. **Digital Health:** Is the digital infrastructure functioning?
2. **Revenue Protection:** Are the systems that generate leads and revenue working?
3. **Business Intelligence:** What does the data mean, and what should the owner do?

## 7. Product map

**Protect:** website, security, forms, payments  
**Understand:** analytics, leads, revenue, conversion  
**Grow:** SEO, content, ads, reputation, competitors

These signals feed **Guardian AI → Decision Intelligence → Action**.

## 8. MVP features

### Account and tenancy

- Signup and login
- Organizations
- Users
- Roles

### Website

- Website onboarding
- Scanning
- Monitoring

### Digital health

- Uptime
- SSL
- HTTP status
- Response time
- Broken links
- Basic SEO
- Basic security

### Revenue protection

- Critical-page monitoring
- Lead-form monitoring

### Intelligence

- Issues
- Severity
- Health score
- Recommendations
- AI explanations

### Communication

- Dashboard
- Email alerts

## 9. Free audit

The free audit is the primary acquisition mechanism:

`Website URL → audit → digital health score → critical issues → warnings → opportunities → Protect My Business → account creation → continuous monitoring`

The public audit must be rate-limited and abuse-protected.

## 10. Health score

Guardian creates one understandable score while retaining drill-down metrics. The initial category model is:

- Website: 25%
- Lead Generation: 25%
- Performance: 15%
- SEO: 15%
- Security: 10%
- Reputation: 10%

Scores must be explainable and traceable to measurable signals. The architecture must allow industry-specific weighting later.

## 11. Revenue protection

Monitor forms, checkout, booking, contact, enquiry, WhatsApp, phone calls-to-action, and payment workflows. Ultimately, Guardian should know when a business can no longer receive customers.

Critical conversion-path failures must create a critical revenue-protection issue containing what failed, when it failed, evidence, affected URL/workflow, severity, business impact, and recommended action.

## 12. SEO intelligence

Initial checks include title, meta description, headings, canonical, `robots.txt`, sitemap, indexability, broken links, structured data, and duplicate-content indicators.

Future capabilities include Search Console, rankings, organic traffic, ranking changes, declining pages, content and keyword opportunities, competitor SEO, AI search visibility, and local SEO.

## 13. Security intelligence

Initial checks include SSL problems, insecure headers, exposed configuration, basic vulnerability indicators, outdated WordPress, and suspicious configuration changes. Guardian must clearly communicate that these checks do not constitute a complete cybersecurity service.

## 14. Reputation and Google intelligence

Future reputation monitoring includes reviews, ratings, review volume, unanswered reviews, and sentiment. AI may suggest responses; publishing requires authorization unless explicitly configured otherwise.

The platform should support Google Analytics, Search Console, and Business Profile integrations to identify traffic changes, ranking changes, indexing problems, search opportunities, local visibility, review changes, and conversion trends.

## 15. Competitor and marketing intelligence

Customers may define competitors. Guardian may monitor available signals such as website changes, SEO visibility, content, reviews, rankings, landing pages, offers, and digital presence. Collection must comply with applicable law and third-party terms.

Future marketing integrations include Google Ads, Meta Ads, LinkedIn, email platforms, and CRM, with analysis of spend, traffic, conversions, cost per lead, and campaign performance.

## 16. AI Guardian

AI is a decision layer over trusted platform data, not the primary source of truth. Users should be able to ask:

- Why did my score fall?
- What happened this week?
- Are we losing leads?
- What should I fix first?
- Why did traffic drop?
- Which page should I improve?

AI outputs must be grounded in actual business data, not generic guesses.

## 17. AI COO and automated actions

The long-term AI COO provides daily, weekly, and monthly briefings; critical alerts; business opportunities; performance, lead, SEO, marketing, and competitive insights; and recommended actions.

Risky actions follow this flow:

`Problem → Evidence → Recommendation → Risk → Approval → Action → Verification → Rollback`

High-risk operations must never run automatically without explicit authorization. Every action requires an audit log.

## 18. WordPress, agency, and white-label direction

Future Guardian Connect capabilities include website connection, WordPress/PHP/plugin/theme status, security, performance, backups, updates, and health status. AutoFix is a later capability.

Agency capabilities include multiple clients, team members, permissions, bulk monitoring, bulk reporting, white label, client notifications, agency billing, and client management.

White-label capabilities include custom logo, colors, domain, email branding, reports, and dashboard branding.

## 19. Reporting, billing, and API

Reports should include health score, critical and resolved issues, trends, leads, SEO, performance, security, reputation, opportunities, and recommended actions.

Billing must support Free, Starter, Growth, Pro, Agency, and Enterprise plans; subscriptions, trials, upgrades, downgrades, cancellations, invoices, payment failures, and webhooks. Pricing must be centrally configured and never hardcoded throughout the application.

The API must be versioned under `/api/v1` and support businesses, websites, scans, issues, health, reports, integrations, notifications, and actions. It requires authentication, authorization, rate limiting, validation, logging, and API keys.

## 20. Data and background jobs

The normalized relational model should support users, organizations, organization members, roles, permissions, businesses, websites, digital assets, monitoring checks/results, issues/events, health scores/components, recommendations, actions/logs, notifications/preferences, integrations/credentials, reports/templates, audit logs, subscriptions/plans/invoices, payments, competitors/snapshots, leads/events, conversions, SEO/performance/security/reputation events, AI conversations/messages/runs, background jobs, webhooks, and API keys.

Use foreign keys, indexes, timestamps, and soft deletion where appropriate. Never store plaintext credentials or secrets.

Background jobs include website scans, uptime, SSL, broken links, SEO, performance, lead tests, reports, notifications, integration synchronization, AI processing, and competitor monitoring. Jobs require retry, backoff, timeout, dead-letter handling, idempotency, and logging.

## 21. Notifications and security

Initial notification channels are email and in-app. Future channels include WhatsApp, SMS, Slack, Teams, and push notifications. Users need per-user preferences.

Mandatory security properties include secure authentication, RBAC, tenant isolation, input validation, output encoding, CSRF protection where applicable, rate limiting, secure cookies, encrypted secrets, encryption in transit, audit logs, webhook verification, dependency scanning, security headers, backup strategy, least privilege, and OWASP-aligned practices.

## 22. Development and testing standards

Preferred stack: Next.js, React, TypeScript, Tailwind CSS, Node.js services where needed, PostgreSQL, Prisma or equivalent, Supabase Auth or equivalent, object storage, queue-based jobs, Stripe behind an abstraction, transactional email, provider-abstracted AI, and deployment that is not tightly coupled to one host.

Required testing includes unit, integration, API, authorization, tenant-isolation, background-job, monitoring, AI contract, security, and end-to-end tests. Critical flows must be automated.

## 23. Development phases

1. Architecture
2. Foundation
3. Authentication and organizations
4. Business and website management
5. Dashboard
6. Website monitoring
7. Issue engine
8. Digital Health Score
9. Revenue Protection
10. AI Guardian
11. Notifications
12. Free Audit
13. Billing
14. Beta
15. Google integrations
16. SEO Intelligence
17. WordPress
18. Reputation
19. Competitor Intelligence
20. Marketing Intelligence
21. Agency Platform
22. Automated Remediation
23. API Platform
24. Mobile
25. Marketplace
26. Predictive Intelligence
27. AI COO

## 24. MVP exit criteria

Before major expansion, the MVP must create an account, organization, business, and website; scan a website; monitor uptime; check SSL and HTTP; measure response time; detect broken links; perform basic SEO and security checks; monitor critical lead forms; create issues; calculate a health score; explain issues; provide recommendations; send alerts; and maintain history.

At least 5–10 real businesses must test the MVP before major expansion.

## 25. Competitive strategy and product evolution

Guardian must not compete primarily as “another website monitor.” Its differentiation is digital business intelligence connecting website, SEO, performance, security, leads, conversions, reputation, analytics, marketing, competitors, and CRM into business impact, priorities, recommendations, and actions.

The evolutionary stages are:

`MONITOR → DIAGNOSE → RECOMMEND → ACT → PREDICT → AI COO`

The first hill to climb is:

> Can Guardian detect problems in a real business’s digital revenue infrastructure and explain why those problems matter?

## 26. Master product rule

Do not measure Guardian by how much code is produced. Measure it by how much business pain is eliminated. A successful Guardian detects failures that matter, explains business impact, prioritizes action, helps users resolve problems, and improves business outcomes.
