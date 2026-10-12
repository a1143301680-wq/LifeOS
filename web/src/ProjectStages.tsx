import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { ApiError, getProjectStages, putProjectStages } from "./api";
import type { ProjectStageCollection, ProjectStagePayload } from "./types";

type DraftStage = ProjectStagePayload["stages"][number];
type FailedAttempt = { fingerprint: string; key: string };

export default function ProjectStages({ token, projectId, onUnauthorized, onSaved }: {
  token: string;
  projectId: string;
  onUnauthorized: (message: string | null) => void;
  onSaved: () => void;
}) {
  const [collection, setCollection] = useState<ProjectStageCollection | null>(null);
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftStage[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error" | "validation">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [failedAttempt, setFailedAttempt] = useState<FailedAttempt | null>(null);
  const active = useRef(false);
  const loadRequest = useRef(0);
  const saving = useRef(false);

  useEffect(() => {
    active.current = true;
    const requestId = ++loadRequest.current;
    setLoadStatus("loading");
    void getProjectStages(token, projectId).then((loaded) => {
      if (!active.current || loadRequest.current !== requestId) return;
      setCollection(loaded);
      setLoadStatus("ready");
    }).catch((error) => {
      if (!active.current || loadRequest.current !== requestId) return;
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized("Your identity expired. Enter the token again.");
        return;
      }
      setLoadStatus("error");
    });
    return () => { active.current = false; loadRequest.current += 1; };
  }, [token, projectId, reload, onUnauthorized]);

  function startEdit() {
    if (!collection) return;
    setDraft(collection.stages.map(({ id, name }) => ({ id, name })));
    setCurrentId(collection.current_stage_id);
    setSaveStatus("idle");
    setMessage(null);
    setFailedAttempt(null);
    setEditing(true);
  }

  function changeDraft(next: DraftStage[], nextCurrent = currentId) {
    setDraft(next);
    setCurrentId(nextCurrent);
    setSaveStatus("idle");
    setMessage(null);
  }

  function move(index: number, offset: number) {
    const next = [...draft];
    const other = index + offset;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    changeDraft(next);
  }

  async function save() {
    if (saving.current) return;
    const payload: ProjectStagePayload = {
      stages: draft.map((stage) => ({ id: stage.id, name: stage.name.trim() })),
      current_stage_id: currentId,
    };
    if (payload.stages.length > 20 || payload.stages.some((stage) => !stage.name || stage.name.length > 100)) {
      setSaveStatus("validation");
      setMessage("Stage names must be 1-100 characters.");
      return;
    }
    const fingerprint = JSON.stringify(payload);
    const key = failedAttempt?.fingerprint === fingerprint ? failedAttempt.key : crypto.randomUUID();
    saving.current = true;
    setSaveStatus("saving");
    setMessage(null);
    try {
      const saved = await putProjectStages(token, projectId, key, payload);
      if (!active.current) return;
      setCollection(saved);
      setEditing(false);
      setSaveStatus("idle");
      setFailedAttempt(null);
      onSaved();
    } catch (error) {
      if (!active.current) return;
      if (error instanceof ApiError && error.status === 401) {
        onUnauthorized("Your identity expired. Enter the token again.");
        return;
      }
      if (error instanceof ApiError && (error.status === 400 || error.status === 409)) {
        setSaveStatus("validation");
        setMessage("Could not save these stages. Review the draft and try again.");
        setFailedAttempt(null);
      } else {
        setSaveStatus("error");
        setMessage("Could not save stages. Retry when the connection is available.");
        setFailedAttempt({ fingerprint, key });
      }
    } finally {
      saving.current = false;
    }
  }

  return <section className="project-stages" aria-label="Project stages">
    <div className="project-stages-heading">
      <h3>Stages</h3>
      {!editing && loadStatus === "ready" ? <button className="secondary-button" type="button" onClick={startEdit}><Pencil aria-hidden="true" />Edit stages</button> : null}
    </div>
    {loadStatus === "loading" ? <p role="status">Loading stages...</p> : null}
    {loadStatus === "error" ? <div role="alert" className="project-stages-error"><span>Could not load stages.</span><button className="secondary-button" type="button" onClick={() => setReload((value) => value + 1)}><RefreshCw aria-hidden="true" />Retry stages</button></div> : null}
    {loadStatus === "ready" && collection && !editing ? <>
      <p className="project-stages-current">Current: {collection.stages.find((stage) => stage.id === collection.current_stage_id)?.name ?? "No current stage"}</p>
      {collection.stages.length ? <ol className="project-stages-list">{collection.stages.map((stage) => <li key={stage.id} aria-current={stage.id === collection.current_stage_id ? "step" : undefined}>{stage.name}</li>)}</ol> : <p className="dashboard-empty">No stages</p>}
    </> : null}
    {editing ? <div className="project-stages-editor">
      <label htmlFor="stage-current">Current stage</label>
      <select id="stage-current" value={currentId ?? ""} onChange={(event) => changeDraft(draft, event.target.value || null)} disabled={saveStatus === "saving"}>
        <option value="">None</option>
        {draft.map((stage, index) => <option key={stage.id} value={stage.id}>{stage.name.trim() || `Stage ${index + 1}`}</option>)}
      </select>
      {draft.length ? <ol className="project-stages-edit-list">{draft.map((stage, index) => <li key={stage.id}>
        <input aria-label={`Stage ${index + 1} name`} value={stage.name} maxLength={100} disabled={saveStatus === "saving"} onChange={(event) => changeDraft(draft.map((item) => item.id === stage.id ? { ...item, name: event.target.value } : item))} />
        <div className="project-stages-tools">
          <button className="icon-button" type="button" title="Move stage up" aria-label={`Move stage ${index + 1} up`} onClick={() => move(index, -1)} disabled={index === 0 || saveStatus === "saving"}><ArrowUp aria-hidden="true" /></button>
          <button className="icon-button" type="button" title="Move stage down" aria-label={`Move stage ${index + 1} down`} onClick={() => move(index, 1)} disabled={index === draft.length - 1 || saveStatus === "saving"}><ArrowDown aria-hidden="true" /></button>
          <button className="icon-button" type="button" title="Remove stage" aria-label={`Remove stage ${index + 1}`} onClick={() => changeDraft(draft.filter((item) => item.id !== stage.id), currentId === stage.id ? null : currentId)} disabled={saveStatus === "saving"}><Trash2 aria-hidden="true" /></button>
        </div>
      </li>)}</ol> : <p className="dashboard-empty">No stages</p>}
      <button className="secondary-button" type="button" onClick={() => changeDraft([...draft, { id: crypto.randomUUID(), name: "" }])} disabled={draft.length >= 20 || saveStatus === "saving"}><Plus aria-hidden="true" />Add stage</button>
      <div className="project-form-actions"><button className="primary-button" type="button" onClick={() => void save()} disabled={saveStatus === "saving"}>{saveStatus === "saving" ? "Saving..." : "Save stages"}</button><button className="secondary-button" type="button" onClick={() => { setEditing(false); setMessage(null); setFailedAttempt(null); }} disabled={saveStatus === "saving"}>Cancel</button></div>
      {message ? <p role="alert" className="project-stages-message">{message}</p> : null}
    </div> : null}
  </section>;
}
