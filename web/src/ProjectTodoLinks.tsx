import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Pencil, RefreshCw, Trash2 } from "lucide-react";

import { ApiError, getProjectTodoLinks, getTodoCandidates, putProjectTodoLinks } from "./api";
import ProjectTodoDetail from "./ProjectTodoDetail";
import type { ProjectTodoLink, ProjectTodoLinkCollection, Todo } from "./types";

type Props = { token: string; projectId: string; timezone: string; onUnauthorized: (message: string | null) => void; onSaved: () => Promise<void> };

export default function ProjectTodoLinks(props: Props) {
  return <LinkEditor key={`${props.token}:${props.projectId}`} {...props} />;
}

function LinkEditor({ token, projectId, timezone, onUnauthorized, onSaved }: Props) {
  const [collection, setCollection] = useState<ProjectTodoLinkCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectTodoLink[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Todo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasPage, setHasPage] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const active = useRef(false);
  const readNumber = useRef(0);
  const pageGeneration = useRef(0);
  const pageBusy = useRef(false);
  const usedCursors = useRef(new Set<string>());
  const writeBusy = useRef(false);
  const needsParent = useRef(false);
  const failedAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const parentRefresh = useRef(onSaved);
  parentRefresh.current = onSaved;
  const sourceTrigger = useRef<HTMLButtonElement | null>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);

  function expired(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized("Your identity expired. Enter the token again.");
      return true;
    }
    return false;
  }

  async function refresh() {
    const id = ++readNumber.current;
    const parent = needsParent.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [loaded] = await Promise.all([getProjectTodoLinks(token, projectId), parent ? parentRefresh.current() : Promise.resolve()]);
      if (!active.current || id !== readNumber.current) return;
      setCollection(loaded);
      needsParent.current = false;
    } catch (error) {
      if (!active.current || id !== readNumber.current || expired(error)) return;
      setLoadError(parent ? "Links saved. Could not refresh the latest data." : "Could not load linked Todos.");
    } finally {
      if (active.current && id === readNumber.current) setLoading(false);
    }
  }

  useEffect(() => {
    active.current = true;
    void refresh();
    return () => { active.current = false; readNumber.current += 1; pageGeneration.current += 1; };
  }, [token, projectId]);

  useEffect(() => {
    if (!returnFocus.current || loading || sourceId !== null) return;
    returnFocus.current = false;
    if (sourceTrigger.current?.isConnected) sourceTrigger.current.focus();
    else refreshButton.current?.focus();
  }, [collection, loading, sourceId]);

  async function loadPage(cursor: string | null, generation: number) {
    if (pageBusy.current) return;
    pageBusy.current = true;
    setPageLoading(true);
    setPageError(false);
    try {
      const page = await getTodoCandidates(token, cursor);
      if (!active.current || generation !== pageGeneration.current) return;
      if (page.next_cursor !== null && (page.next_cursor === cursor || usedCursors.current.has(page.next_cursor))) throw new ApiError(0);
      if (cursor !== null) usedCursors.current.add(cursor);
      setCandidates((current) => [...new Map([...current, ...page.items].map((item) => [item.id, item])).values()]);
      setNextCursor(page.next_cursor);
      setHasPage(true);
    } catch (error) {
      if (!active.current || generation !== pageGeneration.current || expired(error)) return;
      setPageError(true);
    } finally {
      if (active.current && generation === pageGeneration.current) { pageBusy.current = false; setPageLoading(false); }
    }
  }

  function resetPages() {
    pageGeneration.current += 1;
    pageBusy.current = false;
    usedCursors.current.clear();
    setCandidates([]);
    setHasPage(false);
    setNextCursor(null);
    setPageError(false);
    setPageLoading(false);
  }

  function beginEdit() {
    if (!collection) return;
    setDraft(collection.links.map((link) => ({ ...link })));
    setEditing(true);
    setSaveError(null);
    failedAttempt.current = null;
    resetPages();
    void loadPage(null, pageGeneration.current);
  }

  function change(next: ProjectTodoLink[]) { setDraft(next); setSaveError(null); }

  function move(index: number, offset: number) {
    const next = [...draft];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    change(next);
  }

  async function save() {
    if (writeBusy.current) return;
    const ids = draft.map((link) => link.todo_id);
    if (ids.length > 50 || new Set(ids).size !== ids.length) { setSaveError("Choose at most 50 distinct Todos."); return; }
    const fingerprint = JSON.stringify(ids);
    const key = failedAttempt.current?.fingerprint === fingerprint ? failedAttempt.current.key : crypto.randomUUID();
    writeBusy.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await putProjectTodoLinks(token, projectId, key, ids);
      if (!active.current) return;
      setCollection(saved);
      setEditing(false);
      setDraft([]);
      resetPages();
      failedAttempt.current = null;
      needsParent.current = true;
      void refresh();
    } catch (error) {
      if (!active.current || expired(error)) return;
      const deterministic = error instanceof ApiError && (error.status === 400 || error.status === 409);
      failedAttempt.current = deterministic ? null : { fingerprint, key };
      setSaveError(deterministic ? "Could not save these links. Review the selection and try again." : "Could not save links. Try again.");
    } finally {
      writeBusy.current = false;
      if (active.current) setSaving(false);
    }
  }

  async function closeSource() {
    returnFocus.current = true;
    setSourceId(null);
    await refresh();
  }

  function sourceSummary(link: ProjectTodoLink) {
    return link.unavailable || !link.todo ? <><strong>Todo unavailable</strong><small>{link.todo_id}</small></> : <>
      <strong>{link.todo.title}</strong><span>{link.todo.status} · {link.todo.priority}</span>
      <span>{link.todo.planned_date ?? "No planned date"}{link.todo.due_at ? ` · ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(link.todo.due_at))}` : ""}</span>
    </>;
  }

  return <section className="project-todo-links" aria-label="Linked Todos">
    <div className="linked-todos-heading"><h3>Linked Todos</h3><div className="linked-todo-tools">
      {collection && !editing ? <button className="secondary-button" type="button" disabled={loading || !!loadError || sourceId !== null} onClick={beginEdit}><Pencil aria-hidden="true" />Edit links</button> : null}
      <button ref={refreshButton} className="icon-button" type="button" title="Refresh linked Todos" aria-label="Refresh linked Todos" disabled={loading || editing} onClick={() => void refresh()}><RefreshCw aria-hidden="true" /></button>
    </div></div>
    {loading ? <p role="status">Loading linked Todos...</p> : null}
    {loadError ? <p role="alert" className="linked-todo-error">{loadError}</p> : null}
    {!editing && collection ? collection.links.length ? <ol className="linked-todo-list">{collection.links.map((link) => <li key={link.todo_id}>
      <div className="linked-todo-summary">{sourceSummary(link)}</div>
      {!link.unavailable && link.todo ? <button className="icon-button" type="button" title="Open source Todo" aria-label={`Open Todo ${link.todo.title}`} onClick={(event) => { sourceTrigger.current = event.currentTarget; setSourceId(link.todo_id); }}><ExternalLink aria-hidden="true" /></button> : null}
    </li>)}</ol> : <p className="dashboard-empty">No linked Todos</p> : null}
    {editing ? <div className="linked-todo-editor">
      <p className="linked-todo-count">{draft.length}/50 selected</p>
      <ol className="linked-todo-list linked-todo-selected" aria-label="Selected Todos">{draft.map((link, index) => <li key={link.todo_id}>
        <div className="linked-todo-summary">{sourceSummary(link)}</div><div className="linked-todo-tools">
          <button className="icon-button" type="button" title="Move link up" aria-label={`Move link ${index + 1} up`} disabled={saving || index === 0} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></button>
          <button className="icon-button" type="button" title="Move link down" aria-label={`Move link ${index + 1} down`} disabled={saving || index === draft.length - 1} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></button>
          <button className="icon-button" type="button" title="Remove link" aria-label={`Remove link ${index + 1}`} disabled={saving} onClick={() => change(draft.filter((item) => item.todo_id !== link.todo_id))}><Trash2 aria-hidden="true" /></button>
        </div>
      </li>)}</ol>
      <h4>Available Todos</h4>
      <div className="linked-todo-candidates">{candidates.filter((todo) => !draft.some((link) => link.todo_id === todo.id)).map((todo) => <label key={todo.id}>
        <input type="checkbox" aria-label={`Link ${todo.title}`} checked={false} disabled={saving || draft.length >= 50} onChange={() => change([...draft, { todo_id: todo.id, sort_order: draft.length, unavailable: false, todo }])} />
        <span><strong>{todo.title}</strong><small>{todo.status} · {todo.priority}</small></span>
      </label>)}</div>
      {pageLoading ? <p role="status">Loading candidates...</p> : null}
      {pageError ? <p className="linked-todo-error" role="alert">Could not load Todo candidates.</p> : null}
      {pageError || !hasPage || nextCursor !== null ? <button className="secondary-button" type="button" disabled={pageLoading || saving} onClick={() => void loadPage(hasPage ? nextCursor : null, pageGeneration.current)}><RefreshCw aria-hidden="true" />{pageError ? "Retry candidates" : "Load more"}</button> : null}
      <div className="project-form-actions"><button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save links"}</button><button className="secondary-button" type="button" disabled={saving} onClick={() => { resetPages(); setEditing(false); setDraft([]); failedAttempt.current = null; setSaveError(null); }}>Cancel</button></div>
      {saveError ? <p className="linked-todo-error" role="alert">{saveError}</p> : null}
    </div> : null}
    {sourceId ? <ProjectTodoDetail token={token} todoId={sourceId} timezone={timezone} onUnauthorized={onUnauthorized} onClose={() => void closeSource()} onRefresh={refresh} /> : null}
  </section>;
}
