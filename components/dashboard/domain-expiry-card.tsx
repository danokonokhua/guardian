"use client";

export interface DomainExpiryInfo {
  domain: string;
  expiresAt?: string;
  checkedAt?: string;
  state?: string;
  daysRemaining?: number | null;
}

export function calculateDaysRemaining(expiresAt?: string, checkedAt?: string): number | null {
  if (!expiresAt) return null;
  const target = Date.parse(expiresAt);
  const base = checkedAt ? Date.parse(checkedAt) : Date.now();
  if (Number.isNaN(target) || Number.isNaN(base)) return null;
  return Math.ceil((target - base) / (1000 * 60 * 60 * 24));
}

export function DomainExpiryCard({
  items,
}: {
  items: Array<{ domain: string; expiresAt?: string; checkedAt?: string; state?: string }>;
}) {
  if (!items || items.length === 0) return null;

  const analyzed = items.map((item) => {
    const days = calculateDaysRemaining(item.expiresAt, item.checkedAt);
    return { ...item, days };
  }).sort((a, b) => {
    if (a.days === null) return 1;
    if (b.days === null) return -1;
    return a.days - b.days;
  });

  const urgent = analyzed[0];
  if (!urgent) return null;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Domain Expiry Radar
            </h4>
            <p className="text-sm font-semibold text-neutral-200">
              {urgent.domain}
            </p>
          </div>
        </div>

        <div className="text-right">
          {urgent.days === null ? (
            <span className="inline-flex items-center rounded-md bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-300">
              Expiry Unknown
            </span>
          ) : urgent.days <= 0 ? (
            <span className="inline-flex items-center rounded-md bg-red-900/60 border border-red-700/60 px-2.5 py-1 text-xs font-bold text-red-200 animate-pulse">
              EXPIRED
            </span>
          ) : urgent.days <= 14 ? (
            <span className="inline-flex items-center rounded-md bg-red-900/50 border border-red-700/50 px-2.5 py-1 text-xs font-bold text-red-200">
              {urgent.days} days remaining
            </span>
          ) : urgent.days <= 30 ? (
            <span className="inline-flex items-center rounded-md bg-amber-900/50 border border-amber-700/50 px-2.5 py-1 text-xs font-semibold text-amber-200">
              {urgent.days} days remaining
            </span>
          ) : (
            <span className="inline-flex items-center rounded-md bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 text-xs font-medium text-emerald-300">
              {urgent.days} days until renewal
            </span>
          )}
        </div>
      </div>

      {analyzed.length > 1 && (
        <div className="mt-3 pt-2 border-t border-neutral-800/60 flex flex-wrap gap-2 text-xs text-neutral-400">
          <span className="text-neutral-500">Other domains:</span>
          {analyzed.slice(1).map((d) => (
            <span key={d.domain} className="inline-flex items-center gap-1">
              <span>{d.domain}</span>
              <span className={d.days && d.days <= 30 ? "text-amber-400 font-medium" : "text-neutral-400"}>
                ({d.days !== null ? `${d.days}d` : "?"})
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

