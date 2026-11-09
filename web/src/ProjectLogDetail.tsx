import { useEffect, useRef, useState } from "react";
import { Pencil, RefreshCw, Save, Trash2, X } from "lucide-react";

import { ApiError, getProjectLog, writeProjectLog } from "./api";
import type { ProjectLog } from "./types";

type Props = { token: string; projectId: string; logId: string | null; onUnauthorized: (message: string | null) => void; onClose: () => void; onSaved: () => Promise<void> };

export default function ProjectLogDetail(props: Props) {
  return <LogDetail key={`${props.token}:${props.projectId}:${props.logId}`} {...props} />;
}

function LogDetail({ token, projectId, logId, onUnauthorized, onClose, onSaved }: Props) {
  const [log, setLog] = useState<ProjectLog | null>(null);
  const [status, setStatus] = useState(logId ? "loading" : "ready");
  const [editing, setEditing] = useState(!logId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const active = useRef(false);
  const read = useRef(0);
  const busy = useRef(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  function expired(caught: unknown) {
    if (caught instanceof ApiError && caught.status === 401) {
      onUnauthorized("Your identity expired. Enter the token again.");
      return true;
    }
    return false;
  }

  async function load() {
    if (!logId) return;
    const request = ++read.current;
    setLog(null); setStatus("loading");
    try {
      const loaded = await getProjectLog(token, projectId, logId);
      if (!active.current || request !== read.current) return;
      setLog(loaded); setStatus("ready");
    } catch (caught) {
      if (!active.current || request !== read.current || expired(caught)) return;
      setStatus(caught instanceof ApiError && (caught.status === 404 || caught.status === 410) ? "unavailable" : "error");
    }
  }

  useEffect(() => {
    active.current = true; heading.current?.focus(); void load();
    return () => { active.current = false; read.current++; };
  }, []);

  async function refreshAfterSave() {
    try {
      await onSaved();
      if (active.current) onClose();
    } catch (caught) {
      if (!active.current || expired(caught)) return;
      setNeedsRefresh(true); setError("Log saved. Could not refresh Project timeline.");
    }
  }

  async function save(remove = false) {
    if (busy.current || needsRefresh) return;
    const payload = { title: title.trim(), content: content.trim() || null };
    if (!remove && (!payload.title || [...payload.title].length > 200 || [...(payload.content ?? "")].length > 4000)) {
      setError("Check the log title and content."); return;
    }
    const method = remove ? "DELETE" : logId ? "PATCH" : "POST";
    const fingerprint = JSON.stringify({ method, logId, payload: remove ? null : payload });
    const key = retry.current?.fingerprint === fingerprint ? retry.current.key : crypto.randomUUID();
    busy.current = true; setSaving(true); setError(null);
    try {
      await writeProjectLog(token, projectId, logId, method, key, remove ? undefined : payload);
      if (!active.current) return;
      retry.current = null; setNeedsRefresh(true); setEditing(false); setLog(null); setConfirmDelete(false);
      await refreshAfterSave();
    } catch (caught) {
      if (!active.current || expired(caught)) return;
      if (caught instanceof ApiError && (caught.status === 404 || caught.status === 410)) {
        setEditing(false); setLog(null); setConfirmDelete(false); setStatus("unavailable"); retry.current = null;
      } else {
        retry.current = caught instanceof ApiError && (caught.status === 400 || caught.status === 409) ? null : { fingerprint, key };
        setError(caught instanceof ApiError && caught.status === 409 ? "This log write conflicts with an earlier attempt." : "Could not save log. Try again.");
      }
    } finally {
      busy.current = false; if (active.current) setSaving(false);
    }
  }

  return <section className="project-log-detail" aria-label="Project log detail">
    <div className="linked-todos-heading"><h4 ref={heading} tabIndex={-1}>{logId ? "Project log" : "New log"}</h4>
      <button className="icon-button" title="Back to Timeline" aria-label="Back to Timeline" disabled={saving} onClick={onClose}><X aria-hidden="true" /></button></div>
    {!needsRefresh && status === "loading" ? <p role="status">Loading log...</p> : null}
    {!needsRefresh && status === "unavailable" ? <p role="status">Log unavailable</p> : null}
    {!needsRefresh && logId && !editing ? <button className="secondary-button" disabled={saving || status === "loading"} onClick={() => void load()}><RefreshCw aria-hidden="true" />{status === "error" ? "Retry log" : "Refresh log"}</button> : null}
    {status === "error" ? <p role="alert">Could not load log.</p> : null}
    {editing ? <form className="project-log-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label>Log title<input value={title} required onChange={(event) => setTitle(event.target.value)} /></label>
      <label>Log content<textarea value={content} rows={5} onChange={(event) => setContent(event.target.value)} /></label>
      <div className="project-form-actions"><button className="primary-button" disabled={saving} type="submit"><Save aria-hidden="true" />{saving ? "Saving..." : "Save log"}</button>
        <button className="secondary-button" type="button" disabled={saving} onClick={() => { retry.current = null; setError(null); if (logId) setEditing(false); else onClose(); }}>Cancel</button></div>
    </form> : null}
    {!editing && !needsRefresh && log ? <><h5>{log.title}</h5><p className="linked-todo-note">{log.content}</p><div className="project-form-actions">
      <button className="secondary-button" disabled={saving} onClick={() => { read.current++; setTitle(log.title); setContent(log.content ?? ""); setEditing(true); setConfirmDelete(false); setError(null); retry.current = null; }}><Pencil aria-hidden="true" />Edit log</button>
      <button className="secondary-button" disabled={saving} onClick={() => { setConfirmDelete(true); setError(null); }}><Trash2 aria-hidden="true" />Delete log</button></div></> : null}
    {confirmDelete && !needsRefresh ? <div role="group" aria-label="Confirm log deletion"><p>Delete this log?</p><button className="secondary-button" disabled={saving} onClick={() => void save(true)}><Trash2 aria-hidden="true" />Confirm delete log</button><button className="secondary-button" disabled={saving} onClick={() => { setConfirmDelete(false); retry.current = null; }}>Cancel deletion</button></div> : null}
    {error ? <p role="alert">{error}</p> : null}
    {needsRefresh ? <button className="secondary-button" disabled={saving} onClick={() => void refreshAfterSave()}><RefreshCw aria-hidden="true" />Retry timeline refresh</button> : null}
  </section>;
}
