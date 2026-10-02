"use client";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  incidentStates,
  publicDocument,
  states,
  type StatusDocument,
} from "@/lib/status-pages/model";
import { StatusView } from "./status-view";
type Page = {
  id: string;
  slug: string;
  version: number;
  published: boolean;
  document: StatusDocument;
};
type Audit = { action: string; version: number; createdAt: string; actorId: string };
function Input({
  name,
  label,
  value = "",
  type = "text",
  maxLength = 1500,
}: {
  name: string;
  label: string;
  value?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={value} required maxLength={maxLength} />
    </label>
  );
}
function Summary() {
  return (
    <label>
      Approved public summary
      <textarea name="summary" required maxLength={1500} />
    </label>
  );
}
function Components({ doc }: { doc: StatusDocument }) {
  return (
    <fieldset>
      <legend>Affected services</legend>
      {doc.components.map((c) => (
        <label key={c.id} className="status-checkbox">
          <input type="checkbox" name="componentIds" value={c.id} />
          {c.name}
          {!c.visible ? " (hidden)" : ""}
        </label>
      ))}
    </fieldset>
  );
}
function Form({
  children,
  submit,
  busy,
}: {
  children: ReactNode;
  submit: (data: FormData) => void;
  busy: boolean;
}) {
  return (
    <form
      className="status-form"
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      <fieldset disabled={busy} style={{ display: "grid", gap: 14 }}>
        {children}
      </fieldset>
    </form>
  );
}
export function StatusManager({
  organizationId,
  canManage,
}: {
  organizationId: string;
  canManage: boolean;
}) {
  const base = `/api/v1/organizations/${organizationId}/status-pages`;
  const [pages, setPages] = useState<Page[]>([]),
    [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [loaded, setLoaded] = useState(false),
    [audit, setAudit] = useState<Audit[]>([]);
  const [asOf, setAsOf] = useState(0);
  const page = pages.find((p) => p.id === selected);
  const load = useCallback(async () => {
    const response = await fetch(base, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw Error(result.error?.message ?? "Unable to load status pages.");
    setPages(result.data);
    setSelected((s) => s || result.data[0]?.id || "");
    setLoaded(true);
    setAsOf(Date.now());
  }, [base]);
  useEffect(() => {
    const timer = setTimeout(() => {
      void load().catch((e) => setError(e.message));
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function mutate(data: Record<string, unknown>, create = false) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(create ? base : `${base}/${page!.id}`, {
        method: create ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(create ? data : { ...data, version: page!.version }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message ?? "Unable to save status page.");
      await load();
      setSelected(result.data.id);
      setAudit([]);
      setNotice(
        create
          ? "Private status page created."
          : data.action === "unpublish"
            ? "Page unpublished. Public access removed."
            : data.action === "publish"
              ? "Status page published."
              : "Status page saved.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  function values(data: FormData) {
    return Object.fromEntries(data.entries());
  }
  async function showAudit() {
    try {
      const response = await fetch(`${base}/${page!.id}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw Error(result.error?.message ?? "Unable to load audit history.");
      setAudit(result.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load audit history.");
    }
  }
  return (
    <div className="status-manager">
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="status-actions">
        <button
          className="button-secondary"
          disabled={busy}
          onClick={() => void load().catch((e) => setError(e.message))}
        >
          Refresh pages
        </button>
        <span className="muted">Private by default · Only approved information is published</span>
      </div>
      {!loaded && !error && <p>Loading status pages…</p>}
      {canManage && (
        <details className="status-panel" open={loaded && pages.length === 0}>
          <summary>Create a client status page</summary>
          <Form busy={busy} submit={(data) => void mutate(values(data), true)}>
            <Input name="name" label="Page name" maxLength={100} />
            <Input name="slug" label="Public address slug" maxLength={60} />
            <p className="muted">
              Use 3–60 lowercase letters, numbers or hyphens. The address cannot be changed after
              creation.
            </p>
            <button className="button-primary" type="submit">
              Create private page
            </button>
          </Form>
        </details>
      )}
      {pages.length > 0 && (
        <label>
          Choose status page
          <select
            aria-label="Choose status page"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setAudit([]);
              setNotice("");
            }}
            style={{ width: "100%", padding: 12, background: "#121b2a", color: "white" }}
          >
            {pages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.document.name} · {p.published ? "Published" : "Private"}
              </option>
            ))}
          </select>
        </label>
      )}
      {loaded && !pages.length && !canManage && <p>No status pages have been created.</p>}
      {page && (
        <div key={`${page.id}-${page.version}`} className="status-manager">
          <section className="status-panel">
            <h2>{page.document.name}</h2>
            <p>
              {page.published ? "Public" : "Private — active organization members only"} · Revision{" "}
              {page.version}
            </p>
            <p className="muted">Public address: /status/{page.slug}</p>
            <div className="status-actions">
              {page.published && (
                <a
                  className="button-secondary"
                  href={`/status/${page.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open public page
                </a>
              )}
              {canManage && (
                <button
                  disabled={busy}
                  className="button-primary"
                  onClick={() => {
                    if (
                      window.confirm(
                        page.published
                          ? "Unpublish this page and remove public access?"
                          : "Publish the preview below? Confirm all visible names, summaries and history are approved for anyone to read.",
                      )
                    )
                      void mutate({ action: page.published ? "unpublish" : "publish" });
                  }}
                >
                  {page.published ? "Unpublish page" : "Publish page"}
                </button>
              )}
            </div>
            <p className="muted">
              Edits to a published page update its public content immediately. Review every summary
              before saving. Hidden components and their incident/maintenance entries are excluded.
            </p>
          </section>
          {canManage && (
            <>
              <details className="status-panel">
                <summary>Page settings</summary>
                <Form
                  busy={busy}
                  submit={(data) =>
                    void mutate({
                      action: "settings",
                      ...values(data),
                      notifyTransitions: data.has("notifyTransitions"),
                    })
                  }
                >
                  <Input
                    name="name"
                    label="Page title"
                    value={page.document.name}
                    maxLength={100}
                  />
                  <label>
                    Public description
                    <textarea
                      name="description"
                      maxLength={500}
                      defaultValue={page.document.description}
                    />
                  </label>
                  <label className="status-checkbox">
                    <input
                      type="checkbox"
                      name="notifyTransitions"
                      defaultChecked={page.document.notifyTransitions}
                    />
                    Notify enabled organization destinations on published incident transitions
                  </label>
                  <p className="muted">
                    No public email subscriptions or scheduled maintenance announcements. Repeated
                    updates in the same incident state do not send an alert.
                  </p>
                  <button className="button-primary">Save page settings</button>
                </Form>
              </details>
              <section className="status-panel">
                <h2>Service components</h2>
                <p className="muted">
                  These are operator-confirmed states, not automatic monitor results. Confirm each
                  state at least every 24 hours. Incident updates do not change component states.
                </p>
                {page.document.components.map((c) => (
                  <details key={c.id}>
                    <summary>
                      {c.name} · {c.state.toLowerCase()} · {c.visible ? "Visible" : "Hidden"}
                    </summary>
                    <Form
                      busy={busy}
                      submit={(data) =>
                        void mutate({
                          action: "component",
                          id: c.id,
                          ...values(data),
                          visible: data.has("visible"),
                        })
                      }
                    >
                      <Input name="name" label="Component name" value={c.name} maxLength={80} />
                      <label>
                        Confirmed service state
                        <select name="state" defaultValue={c.state}>
                          {states.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <label className="status-checkbox">
                        <input type="checkbox" name="visible" defaultChecked={c.visible} />
                        Include on published page
                      </label>
                      <button className="button-primary">Confirm component</button>
                    </Form>
                  </details>
                ))}
                <details>
                  <summary>Add service component</summary>
                  <Form
                    busy={busy}
                    submit={(data) =>
                      void mutate({
                        action: "component",
                        ...values(data),
                        visible: data.has("visible"),
                      })
                    }
                  >
                    <Input name="name" label="New component name" maxLength={80} />
                    <label>
                      Initial service state
                      <select name="state" defaultValue="UNKNOWN">
                        {states.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label className="status-checkbox">
                      <input type="checkbox" name="visible" />
                      Include on published page
                    </label>
                    <button className="button-primary">Add component</button>
                  </Form>
                </details>
              </section>
              {page.document.components.length > 0 && (
                <div className="status-split">
                  <details className="status-panel">
                    <summary>Report an incident</summary>
                    <Form
                      busy={busy}
                      submit={(data) =>
                        void mutate({
                          action: "incident",
                          ...values(data),
                          componentIds: data.getAll("componentIds"),
                        })
                      }
                    >
                      <Input name="title" label="Incident title" maxLength={120} />
                      <Summary />
                      <Components doc={page.document} />
                      <button className="button-primary">Report incident</button>
                    </Form>
                  </details>
                  <details className="status-panel">
                    <summary>Schedule maintenance</summary>
                    <Form
                      busy={busy}
                      submit={(data) => {
                        const start = String(data.get("startsAt")),
                          end = String(data.get("endsAt"));
                        void mutate({
                          action: "maintenance",
                          ...values(data),
                          componentIds: data.getAll("componentIds"),
                          startsAt: new Date(start).toISOString(),
                          endsAt: new Date(end).toISOString(),
                        });
                      }}
                    >
                      <Input name="title" label="Maintenance title" maxLength={120} />
                      <Summary />
                      <Components doc={page.document} />
                      <Input
                        name="startsAt"
                        label="Start (your local time)"
                        type="datetime-local"
                      />
                      <Input name="endsAt" label="End (your local time)" type="datetime-local" />
                      <button className="button-primary">Schedule window</button>
                    </Form>
                  </details>
                </div>
              )}
              {page.document.incidents.map((i) => (
                <details key={i.id} className="status-panel">
                  <summary>Manage incident: {i.title}</summary>
                  {i.updates.at(-1)?.status !== "RESOLVED" && (
                    <Form
                      busy={busy}
                      submit={(data) =>
                        void mutate({ action: "update", id: i.id, ...values(data) })
                      }
                    >
                      <label>
                        Incident state
                        <select name="status" defaultValue={i.updates.at(-1)?.status}>
                          {incidentStates.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                      <Summary />
                      <button className="button-primary">Post incident update</button>
                    </Form>
                  )}
                  <button
                    disabled={busy}
                    className="button-secondary"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remove this incident and its public timeline? Previously downloaded copies and sent messages cannot be recalled.",
                        )
                      )
                        void mutate({ action: "redact", id: i.id });
                    }}
                  >
                    Redact incident
                  </button>
                </details>
              ))}
              {page.document.maintenance.map((m) => (
                <div key={m.id} className="status-panel status-actions">
                  <span>{m.title}</span>
                  <button
                    disabled={busy || m.cancelled}
                    className="button-secondary"
                    onClick={() => void mutate({ action: "cancel-maintenance", id: m.id })}
                  >
                    {m.cancelled ? "Maintenance cancelled" : "Cancel maintenance"}
                  </button>
                  <button
                    disabled={busy}
                    className="button-secondary"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Remove this maintenance entry from the page? Previously downloaded copies cannot be recalled.",
                        )
                      )
                        void mutate({ action: "redact-maintenance", id: m.id });
                    }}
                  >
                    Redact maintenance
                  </button>
                </div>
              ))}
              <details className="status-panel">
                <summary>Publication and edit audit</summary>
                <button className="button-secondary" onClick={() => void showAudit()}>
                  Load audit history
                </button>
                {audit.map((a) => (
                  <p key={a.version}>
                    Revision {a.version} · {a.action} · {new Date(a.createdAt).toUTCString()} ·
                    Actor {a.actorId}
                  </p>
                ))}
              </details>
            </>
          )}
          <section aria-label="Approved page preview">
            <h2>{page.published ? "Published content preview" : "Private preview"}</h2>
            <StatusView document={publicDocument(page.document)} now={asOf} />
          </section>
        </div>
      )}
    </div>
  );
}
