import { serviceState, type StatusDocument } from "@/lib/status-pages/model";

export function StatusView({ document, now }: { document: StatusDocument; now: number }) {
  const current = document.components.map((c) => ({ ...c, ...serviceState(document, c, now) }));
  const overall = current.some((c) => c.state === "OUTAGE")
    ? "Service outage"
    : current.some((c) => c.state === "DEGRADED")
      ? "Degraded service"
      : current.some((c) => c.state === "UNKNOWN") || !current.length
        ? "Status awaiting confirmation"
        : current.some((c) => c.state === "MAINTENANCE")
          ? "Scheduled maintenance"
          : "All services operational";
  return (
    <div className="status-view">
      <header className="status-hero">
        <span className="eyebrow">SERVICE STATUS</span>
        <h1>{document.name}</h1>
        <p>{document.description}</p>
        <h2>{overall}</h2>
        <p className="muted">
          Operator-confirmed status · Updated {new Date(document.updatedAt).toUTCString()}
        </p>
      </header>
      <section aria-label="Service components" className="status-panel">
        <h2>Services</h2>
        {current.length ? (
          current.map((c) => (
            <div className="status-component" key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <p className="muted">
                  Confirmed {new Date(c.confirmedAt).toUTCString()}
                  {c.stale ? " · Confirmation is stale" : ""}
                </p>
              </div>
              <span className={`status-state status-${c.state.toLowerCase()}`}>
                {c.state.toLowerCase()}
              </span>
            </div>
          ))
        ) : (
          <p>No services selected for this page.</p>
        )}
        <p className="muted">
          Confirmations older than 24 hours are marked unknown. Refresh to retrieve the latest
          updates.
        </p>
      </section>
      <section aria-label="Incident timeline" className="status-panel">
        <h2>Incident timeline</h2>
        {document.incidents.length ? (
          document.incidents.map((i) => (
            <article className="status-event" key={i.id}>
              <h3>{i.title}</h3>
              <p className="muted">
                {document.components
                  .filter((c) => i.componentIds.includes(c.id))
                  .map((c) => c.name)
                  .join(", ")}
              </p>
              {[...i.updates].reverse().map((u, index) => (
                <div className="status-update" key={`${u.at}-${index}`}>
                  <strong>{u.status.toLowerCase()}</strong>
                  <time>{new Date(u.at).toUTCString()}</time>
                  <p>{u.summary}</p>
                </div>
              ))}
            </article>
          ))
        ) : (
          <p>No published incidents.</p>
        )}
      </section>
      <section aria-label="Scheduled maintenance" className="status-panel">
        <h2>Scheduled maintenance</h2>
        {document.maintenance.length ? (
          document.maintenance.map((m) => (
            <article className="status-event" key={m.id}>
              <h3>{m.title}</h3>
              <span className="status-state">
                {m.cancelled
                  ? "Cancelled"
                  : now >= Date.parse(m.endsAt)
                    ? "Window ended"
                    : now >= Date.parse(m.startsAt)
                      ? "In progress"
                      : "Scheduled"}
              </span>
              <p>{m.summary}</p>
              <p className="muted">
                {new Date(m.startsAt).toUTCString()} — {new Date(m.endsAt).toUTCString()}
              </p>
              <p>
                {document.components
                  .filter((c) => m.componentIds.includes(c.id))
                  .map((c) => c.name)
                  .join(", ")}
              </p>
            </article>
          ))
        ) : (
          <p>No scheduled maintenance.</p>
        )}
        <p className="muted">
          Maintenance windows do not confirm recovery. Service confirmations remain independent.
        </p>
      </section>
    </div>
  );
}
