import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";

import { ApiError, getProjectMilestones, putProjectMilestones } from "./api";
import type { MilestoneCollection, MilestonePayload, MilestoneStatus } from "./types";

type Props = { token: string; projectId: string; onUnauthorized: (message: string | null) => void; onSaved: () => Promise<void> };
type Attempt = { fingerprint: string; key: string };
const statuses: MilestoneStatus[] = ["pending", "completed", "canceled"];

function validDate(value: string | null) {
  if (value === null) return true;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

export default function ProjectMilestones(props: Props) {
  return <MilestoneEditor key={`${props.token}:${props.projectId}`} {...props} />;
}

function MilestoneEditor({ token, projectId, onUnauthorized, onSaved }: Props) {
  const [collection, setCollection] = useState<MilestoneCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MilestonePayload[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const active = useRef(false);
  const requestNumber = useRef(0);
  const saveInFlight = useRef(false);
  const failedAttempt = useRef<Attempt | null>(null);
  const needsParentRefresh = useRef(false);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  function expired(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized("Your identity expired. Enter the token again.");
      return true;
    }
    return false;
  }

  async function refresh() {
    const request = ++requestNumber.current;
    setLoading(true);
    setLoadError(null);
    const refreshParent = needsParentRefresh.current;
    try {
      const [loaded] = await Promise.all([
        getProjectMilestones(token, projectId),
        refreshParent ? onSavedRef.current() : Promise.resolve(),
      ]);
      if (!active.current || request !== requestNumber.current) return;
      setCollection(loaded);
      needsParentRefresh.current = false;
    } catch (error) {
      if (!active.current || request !== requestNumber.current || expired(error)) return;
      setLoadError(refreshParent ? "Milestones saved. Could not refresh the latest data." : "Could not load milestones.");
    } finally {
      if (active.current && request === requestNumber.current) setLoading(false);
    }
  }

  useEffect(() => {
    active.current = true;
    void refresh();
    return () => { active.current = false; requestNumber.current += 1; };
  }, [token, projectId]);

  function edit() {
    if (!collection) return;
    setDraft(collection.milestones.map(({ id, title, target_date, status }) => ({ id, title, target_date, status })));
    failedAttempt.current = null;
    setSaveError(null);
    setEditing(true);
  }

  function change(next: MilestonePayload[]) {
    setDraft(next);
    setSaveError(null);
  }

  function update(id: string, value: Partial<MilestonePayload>) {
    change(draft.map((item) => item.id === id ? { ...item, ...value } : item));
  }

  function move(index: number, offset: number) {
    const next = [...draft];
    const other = index + offset;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    change(next);
  }

  async function save() {
    if (saveInFlight.current) return;
    const payload = draft.map((item) => ({ ...item, title: item.title.trim() }));
    if (payload.length > 50 || payload.some((item) => !item.title || item.title.length > 200 || !validDate(item.target_date) || !statuses.includes(item.status))) {
      setSaveError("Check milestone titles, dates, and statuses.");
      return;
    }
    const fingerprint = JSON.stringify(payload);
    const key = failedAttempt.current?.fingerprint === fingerprint ? failedAttempt.current.key : crypto.randomUUID();
    saveInFlight.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await putProjectMilestones(token, projectId, key, payload);
      if (!active.current) return;
      setCollection(saved);
      setEditing(false);
      setDraft([]);
      failedAttempt.current = null;
      needsParentRefresh.current = true;
      void refresh();
    } catch (error) {
      if (!active.current || expired(error)) return;
      const deterministic = error instanceof ApiError && (error.status === 400 || error.status === 409);
      failedAttempt.current = deterministic ? null : { fingerprint, key };
      setSaveError(deterministic ? "Could not save these milestones. Review the draft and try again." : "Could not save milestones. Try again.");
    } finally {
      saveInFlight.current = false;
      if (active.current) setSaving(false);
    }
  }

  return <section className="project-milestones" aria-label="Project milestones">
    <div className="project-milestones-heading"><h3>Milestones</h3>
      {!editing && collection ? <button className="secondary-button" type="button" onClick={edit} disabled={loading || loadError !== null}><Pencil aria-hidden="true" />Edit milestones</button> : null}
    </div>
    {loading ? <p role="status">Loading milestones...</p> : null}
    {loadError ? <div className="project-milestones-error" role="alert"><span>{loadError}</span><button className="secondary-button" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw aria-hidden="true" />Refresh milestones</button></div> : null}
    {collection && !editing ? collection.milestones.length ? <ol className="milestone-list">{collection.milestones.map((item) => <li key={item.id}>
      <strong>{item.title}</strong><span>{item.target_date ?? "No target date"}</span><span className="milestone-status">{item.status}</span>
    </li>)}</ol> : <p className="dashboard-empty">No milestones</p> : null}
    {editing ? <div className="milestone-editor">
      <ol className="milestone-drafts">{draft.map((item, index) => <li key={item.id}>
        <input aria-label={`Milestone ${index + 1} title`} value={item.title} maxLength={200} disabled={saving} onChange={(event) => update(item.id, { title: event.target.value })} />
        <div className="milestone-fields">
          <input type="date" aria-label={`Milestone ${index + 1} target date`} value={item.target_date ?? ""} min="0001-01-01" max="9999-12-31" disabled={saving} onChange={(event) => update(item.id, { target_date: event.target.value || null })} />
          <button className="icon-button" type="button" title="Clear target date" aria-label={`Clear milestone ${index + 1} date`} disabled={saving || item.target_date === null} onClick={() => update(item.id, { target_date: null })}><X aria-hidden="true" /></button>
          <select aria-label={`Milestone ${index + 1} status`} value={item.status} disabled={saving} onChange={(event) => update(item.id, { status: event.target.value as MilestoneStatus })}>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        <div className="milestone-tools">
          <button className="icon-button" type="button" title="Move milestone up" aria-label={`Move milestone ${index + 1} up`} disabled={saving || index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></button>
          <button className="icon-button" type="button" title="Move milestone down" aria-label={`Move milestone ${index + 1} down`} disabled={saving || index === draft.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></button>
          <button className="icon-button" type="button" title="Remove milestone" aria-label={`Remove milestone ${index + 1}`} disabled={saving} onClick={() => change(draft.filter((row) => row.id !== item.id))}><Trash2 aria-hidden="true" /></button>
        </div>
      </li>)}</ol>
      {!draft.length ? <p className="dashboard-empty">No milestones</p> : null}
      <button className="secondary-button" type="button" disabled={saving || draft.length >= 50} onClick={() => change([...draft, { id: crypto.randomUUID(), title: "", target_date: null, status: "pending" }])}><Plus aria-hidden="true" />Add milestone</button>
      <div className="project-form-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save milestones"}</button><button className="secondary-button" type="button" disabled={saving} onClick={() => { setEditing(false); setDraft([]); failedAttempt.current = null; setSaveError(null); }}>Cancel</button></div>
      {saveError ? <p className="project-milestones-error" role="alert">{saveError}</p> : null}
    </div> : null}
  </section>;
}
