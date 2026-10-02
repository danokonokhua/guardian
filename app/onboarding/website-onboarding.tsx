"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
type Website = {
  id: string;
  hostname: string;
  normalizedUrl: string;
  verifyStatus: string;
  verifyToken: string | null;
};
export function WebsiteOnboarding({
  organizationId,
  canCreate,
  canVerify,
}: {
  organizationId: string;
  canCreate: boolean;
  canVerify: boolean;
}) {
  const verification = usePathname().endsWith("/verify");
  const [websites, setWebsites] = useState<Website[]>([]);
  const [url, setUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const endpoint = `/api/v1/organizations/${organizationId}/websites`;
  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then(async (r) => {
        if (!r.ok) throw Error("Unable to load your websites. Please retry.");
        return r.json();
      })
      .then((body) => {
        if (!cancelled) setWebsites(body.data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint, retry]);
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setMessage(null);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, businessName: businessName || undefined }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error?.message || "Unable to add this website.");
      setWebsites((current) => [...current, body.data]);
      setUrl("");
      setBusinessName("");
      setMessage("Website added. Complete ownership verification below.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add website.");
    } finally {
      setBusy(null);
    }
  }
  async function verify(site: Website) {
    setBusy(site.id);
    setError(null);
    setMessage(null);
    try {
      const r = await fetch(`${endpoint}/${site.id}/verify`, { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw Error(body.error?.message || "Unable to verify this website.");
      if (!body.data?.verified)
        throw Error(
          "Verification file could not be confirmed. Check the file location and token, then try again.",
        );
      setWebsites((current) => current.map((w) => (w.id === site.id ? body.data.website : w)));
      setMessage(`${site.hostname} is verified. You can now configure monitoring.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(null);
    }
  }
  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setMessage("Verification token copied.");
    } catch {
      setError("Copy unavailable. Select and copy the token below manually.");
    }
  }
  return (
    <main className="onboarding-content">
      <ol className="onboarding-steps" aria-label="Website setup steps">
        <li aria-current={!verification ? "step" : undefined}>
          <span>01</span> Connect website
        </li>
        <li aria-current={verification ? "step" : undefined}>
          <span>02</span> Verify ownership
        </li>
        <li>
          <span>03</span> Configure monitoring
        </li>
      </ol>
      <div className="onboarding-heading">
        <span className="eyebrow">CONNECT YOUR DIGITAL BUSINESS</span>
        <h1>
          {verification ? "Verify your website ownership." : "Your website. A clearer picture."}
        </h1>
        <p>
          Connect your website, confirm ownership, and choose the checks that matter to your
          business.
        </p>
      </div>
      <div className="onboarding-grid">
        <div className="space-y-6">
          {!verification && (
            <section className="setup-card">
              <span className="eyebrow">STEP 01 / YOUR WEBSITE</span>
              <h2>Connect a website</h2>
              {canCreate ? (
                <form onSubmit={add} className="space-y-5">
                  <label className="block text-sm">
                    Website URL
                    <input
                      className="guardian-input mt-2"
                      type="url"
                      required
                      placeholder="https://yourbusiness.com"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Business name (optional)
                    <input
                      className="guardian-input mt-2"
                      maxLength={120}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Your business name"
                    />
                  </label>
                  <button className="button-primary" disabled={busy !== null || loading}>
                    {busy === "create" ? "Connecting..." : "Connect website"}
                  </button>
                </form>
              ) : (
                <p>
                  Your role can view websites. Ask an organization administrator to add a website.
                </p>
              )}
            </section>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200"
            >
              {error}
            </div>
          )}
          {message && (
            <p
              role="status"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
            >
              {message}
            </p>
          )}
          <section className="setup-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="eyebrow">STEP 02 / OWNERSHIP VERIFICATION</span>
              <button
                className="quiet-link"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setRetry((n) => n + 1);
                }}
                disabled={loading || busy !== null}
              >
                Refresh websites
              </button>
            </div>
            <h2>{verification ? "Confirm your connection" : "Your connected websites"}</h2>
            {loading ? (
              <p role="status">Loading websites...</p>
            ) : websites.length === 0 ? (
              <p>
                No websites connected yet.{" "}
                {verification && (
                  <Link href="/onboarding" className="quiet-link">
                    Add your first website
                  </Link>
                )}
              </p>
            ) : (
              <div className="space-y-5">
                {websites.map((site) => (
                  <article className="verification-card" key={site.id}>
                    <div className="flex flex-wrap justify-between gap-3">
                      <h3>{site.hostname}</h3>
                      <span className="status-pill">
                        {site.verifyStatus === "VERIFIED" ? "VERIFIED" : "AWAITING VERIFICATION"}
                      </span>
                    </div>
                    {site.verifyStatus === "VERIFIED" ? (
                      <>
                        <p>
                          Ownership confirmed. Choose monitoring checks to begin collecting results.
                        </p>
                        <Link href="/dashboard#monitoring" className="button-primary compact">
                          Configure monitoring
                        </Link>
                      </>
                    ) : (
                      <>
                        <p>
                          Publish a plain text file containing this exact token at the address
                          below. Guardian will fetch the file to confirm ownership.
                        </p>
                        <label className="block text-xs text-slate-400">
                          Verification token
                          <textarea
                            readOnly
                            rows={2}
                            className="guardian-input mt-2 font-mono"
                            value={site.verifyToken || "Token unavailable"}
                          />
                        </label>
                        <code className="verification-address">
                          {new URL(site.normalizedUrl).origin}/.well-known/guardian-verification.txt
                        </code>
                        <div className="flex flex-wrap gap-3">
                          <button
                            className="button-secondary compact"
                            disabled={!site.verifyToken}
                            onClick={() => void copy(site.verifyToken!)}
                          >
                            Copy token
                          </button>
                          {canVerify && (
                            <button
                              className="button-primary compact"
                              disabled={busy !== null || !site.verifyToken}
                              onClick={() => void verify(site)}
                            >
                              {busy === site.id ? "Checking file..." : "Verify ownership"}
                            </button>
                          )}
                        </div>
                        {!canVerify && (
                          <p>
                            Your role cannot verify websites. Ask an organization administrator.
                          </p>
                        )}
                      </>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="setup-card setup-guide">
          <span className="eyebrow">WHAT HAPPENS NEXT</span>
          <h2>Start with a trusted connection.</h2>
          <ol>
            <li>
              <strong>01 / Connect</strong>
              <p>Add the public URL of the website you manage.</p>
            </li>
            <li>
              <strong>02 / Verify</strong>
              <p>
                Upload the verification file through your hosting provider or ask your website
                administrator.
              </p>
            </li>
            <li>
              <strong>03 / Monitor</strong>
              <p>
                Choose uptime, SSL, SEO, security, link, performance, or lead-form checks in your
                dashboard.
              </p>
            </li>
          </ol>
          <p className="fine-print">
            Verification confirms ownership. It does not automatically enable monitoring or submit
            lead forms.
          </p>
          <Link href={verification ? "/onboarding" : "/onboarding/verify"} className="quiet-link">
            {verification ? "Connect another website" : "Resume verification"}
          </Link>
        </aside>
      </div>
    </main>
  );
}
