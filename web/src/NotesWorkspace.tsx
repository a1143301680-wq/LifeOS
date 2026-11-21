import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronLeft, ExternalLink, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { ApiError, getNote, getNotes, getProject, getTodoSource, writeNote } from "./api";
import NotesSourcePicker from "./NotesSourcePicker";
import type { Note, NoteInput, NoteReference, Project, Todo } from "./types";

type Sources = { project: NoteReference | null; todo: NoteReference | null };
export type NotesContext = { kind: keyof Sources; source: NoteReference };
type Draft = Sources & { id: string | null; title: string; content: string; url: string };
const emptySources: Sources = { project: null, todo: null };

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export default function NotesWorkspace({ sessionId, token, context, visible, onRetainChange, reopenTodoOnBack, onBack, onExpired, onOpenProject, onOpenTodo }: {
  sessionId: number;
  token: string;
  context: NotesContext | null;
  visible: boolean;
  onRetainChange: (id: number, retain: boolean) => void;
  reopenTodoOnBack: boolean;
  onBack: () => void;
  onExpired: () => void;
  onOpenProject: (project: Project) => void;
  onOpenTodo: (todo: Todo, trigger: HTMLButtonElement, returning: boolean) => void;
}) {
  const [filters, setFilters] = useState<Sources>(() => context ? { ...emptySources, [context.kind]: context.source } : emptySources);
  const [items, setItems] = useState<Note[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<"list" | "page" | null>(null);
  const [selected, setSelected] = useState<Note | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailStatus, setDetailStatus] = useState<"loading" | "ready" | "error">("ready");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState(false);
  const sourceRequest = useRef(0);
  const alive = useRef(false);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const writing = useRef(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const projectId = filters.project?.id ?? null;
  const todoId = filters.todo?.id ?? null;

  useLayoutEffect(() => {
    onRetainChange(sessionId, draft !== null || saving || confirm);
  }, [draft !== null, saving, confirm, onRetainChange, sessionId]);

  useLayoutEffect(() => {
    if (!visible) sourceRequest.current++;
  }, [visible]);

  const expired = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onExpired();
      return true;
    }
    return false;
  }, [onExpired]);

  const readList = useCallback(async (after: string | null = null) => {
    const request = ++listRequest.current;
    setLoading(true);
    setListError(null);
    if (after === null) setCursor(null);
    try {
      const page = await getNotes(token, { project_id: projectId, todo_id: todoId }, after);
      if (!alive.current || request !== listRequest.current) return;
      setItems((previous) => [...new Map([...(after ? previous : []), ...page.items].map((note) => [note.id, note])).values()]);
      setCursor(page.next_cursor === after ? null : page.next_cursor ?? null);
    } catch (error) {
      if (alive.current && request === listRequest.current && !expired(error)) setListError(after ? "page" : "list");
    } finally {
      if (alive.current && request === listRequest.current) setLoading(false);
    }
  }, [token, projectId, todoId, expired]);

  useEffect(() => {
    alive.current = true;
    void readList();
    return () => { alive.current = false; listRequest.current++; detailRequest.current++; };
  }, [readList]);

  async function readDetail(id: string) {
    const request = ++detailRequest.current;
    setDetailId(id);
    setDetailStatus("loading");
    setSelected(null);
    setSourceError(false);
    try {
      const note = await getNote(token, id);
      if (!alive.current || request !== detailRequest.current) return;
      setSelected(note);
      setDetailStatus("ready");
    } catch (error) {
      if (alive.current && request === detailRequest.current && !expired(error)) setDetailStatus("error");
    }
  }

  function clearDetail() {
    detailRequest.current++;
    sourceRequest.current++;
    setSelected(null);
    setDetailId(null);
    setDraft(null);
    setConfirm(false);
    setWriteError(null);
    retry.current = null;
  }

  function changeFilters(next: Sources) {
    if (next.project?.id === filters.project?.id && next.todo?.id === filters.todo?.id) return;
    listRequest.current++;
    setItems([]);
    setCursor(null);
    setLoading(true);
    clearDetail();
    setFilters(next);
  }

  function edit(note: Note | null) {
    detailRequest.current++;
    sourceRequest.current++;
    setConfirm(false);
    setWriteError(null);
    retry.current = null;
    setDraft(note ? { id: note.id, title: note.title, content: note.content ?? "", url: note.external_url ?? "", project: note.project, todo: note.todo }
      : { ...filters, id: null, title: "", content: "", url: "" });
  }

  async function openSource(kind: keyof Sources, id: string, trigger: HTMLButtonElement, returning = false) {
    const request = ++sourceRequest.current;
    const current = () => alive.current && request === sourceRequest.current;
    setSourceError(false);
    try {
      if (kind === "project") {
        const project = await getProject(token, id);
        if (current()) onOpenProject(project);
      } else {
        const todo = await getTodoSource(token, id);
        if (current()) onOpenTodo(todo, trigger, returning);
      }
    } catch (error) {
      if (current() && !expired(error)) setSourceError(true);
    }
  }

  async function save(id: string | null, input: NoteInput | null) {
    if (writing.current) return;
    writing.current = true;
    setSaving(true);
    setWriteError(null);
    const fingerprint = JSON.stringify([id, input]);
    const key = retry.current?.fingerprint === fingerprint ? retry.current.key : crypto.randomUUID();
    try {
      const result = await writeNote(token, id, input, key);
      if (!alive.current) return;
      clearDetail();
      void readList();
      if (input !== null) void readDetail(result.id);
    } catch (error) {
      if (!alive.current || expired(error)) return;
      const rejected = error instanceof ApiError && error.status >= 400 && error.status < 500;
      retry.current = rejected ? null : { fingerprint, key };
      setWriteError(error instanceof ApiError && error.status === 404 ? "A note or source is unavailable. Check your selections."
        : rejected ? "Check the note fields and try again." : "Could not save the note. Try again.");
    } finally {
      writing.current = false;
      if (alive.current) setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const title = draft.title.trim();
    const content = draft.content.trim();
    const url = draft.url.trim();
    if (!title || [...title].length > 200 || [...content].length > 10000 ||
        (url && (url.length > 2048 || !/^https?:\/\//i.test(url) || !safeUrl(url)))) {
      setWriteError("Check the title, content length and external URL.");
      return;
    }
    void save(draft.id, { title, content: content || null, external_url: url || null,
      project_id: draft.project?.id ?? null, todo_id: draft.todo?.id ?? null });
  }

  const link = selected?.external_url ? safeUrl(selected.external_url) : null;
  return <>
    <div className="section-heading">
      <h1>Notes</h1>
      <div className="section-actions">
        <button className="primary-button compact" type="button" disabled={saving || draft !== null} onClick={() => edit(null)}><Plus aria-hidden="true" />New note</button>
        <button className="icon-button bordered" type="button" title="Refresh notes" aria-label="Refresh notes" disabled={saving || loading} onClick={() => void readList()}><RefreshCw aria-hidden="true" /></button>
      </div>
    </div>
    {context ? <button className="text-button" type="button" onClick={(event) => {
      if (reopenTodoOnBack) void openSource("todo", context.source.id, event.currentTarget, true);
      else onBack();
    }} disabled={saving}><ChevronLeft aria-hidden="true" />Back to {context.kind === "project" ? "Project" : "Todo"}</button> : null}
    {sourceError ? <p role="alert">Could not open the source.</p> : null}
    <fieldset className="notes-filters" disabled={saving || draft !== null}>
      <legend>Filter notes</legend>
      {(["project", "todo"] as const).map((kind) => <NotesSourcePicker key={kind} kind={kind} token={token} value={filters[kind]}
        onChange={(value) => changeFilters({ ...filters, [kind]: value })} onExpired={onExpired} />)}
      {(projectId || todoId) ? <button type="button" className="secondary-button" onClick={() => changeFilters(emptySources)}>Clear filters</button> : null}
    </fieldset>
    <div className={`projects-layout${draft || detailId ? "" : " projects-layout-single"}`}>
      <section aria-label="Notes list">
        {loading ? <p role="status">Loading notes...</p> : null}
        {listError ? <p role="alert">Could not load notes. <button className="secondary-button" type="button" onClick={() => void readList(listError === "page" ? cursor : null)}>Retry notes</button></p> : null}
        {!loading && !listError && items.length === 0 ? <p>No notes yet</p> : null}
        <ul className="project-list">{items.map((note) => <li key={note.id}>
          <button className="project-row" type="button" disabled={saving || draft !== null} aria-current={detailId === note.id || undefined}
            onClick={() => { clearDetail(); void readDetail(note.id); }}><strong>{note.title}</strong></button>
        </li>)}</ul>
        {cursor && !listError ? <button className="secondary-button" type="button" disabled={loading || saving} onClick={() => void readList(cursor)}><ChevronDown aria-hidden="true" />Load more notes</button> : null}
      </section>
      {draft ? <form className="project-detail notes-editor" onSubmit={submit}>
        <h2>{draft.id ? "Edit note" : "New note"}</h2>
        <fieldset disabled={saving}>
          <label>Title<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
          <label>Content<textarea rows={8} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></label>
          <label>External URL<input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></label>
          {(["project", "todo"] as const).map((kind) => <NotesSourcePicker key={kind} kind={kind} token={token} value={draft[kind]}
            onChange={(value) => setDraft({ ...draft, [kind]: value })} onExpired={onExpired} />)}
          <div className="project-form-actions">
            <button className="primary-button" type="submit">{saving ? "Saving..." : "Save note"}</button>
            <button className="secondary-button" type="button" onClick={() => { setDraft(null); setWriteError(null); retry.current = null; }}>Cancel note edit</button>
          </div>
        </fieldset>
        {writeError ? <p role="alert">{writeError}</p> : null}
      </form> : detailId ? <section className="project-detail notes-detail" aria-label="Note detail">
        <button className="text-button" type="button" disabled={saving} onClick={clearDetail}><ChevronLeft aria-hidden="true" />Back to notes</button>
        {detailStatus === "loading" ? <p role="status">Loading note...</p> : null}
        {detailStatus === "error" ? <p role="alert">Could not load the note. <button className="secondary-button" type="button" onClick={() => void readDetail(detailId)}>Retry note</button></p> : null}
        {selected ? <>
          <h2>{selected.title}</h2>
          {selected.content ? <p className="notes-content">{selected.content}</p> : null}
          {(["project", "todo"] as const).map((kind) => {
            const source = selected[kind];
            const label = kind === "project" ? "Project" : "Todo";
            return !source ? null : source.available ? <p key={kind}><button type="button" className="text-button" disabled={saving || confirm} onClick={(event) => void openSource(kind, source.id, event.currentTarget)}>{label}: {source.label}</button></p>
              : <p key={kind}>Unavailable {label}</p>;
          })}
          {link ? <p><a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} aria-hidden="true" /> Open external link</a></p> : null}
          <div className="project-form-actions">
            <button className="secondary-button" type="button" disabled={saving || confirm} onClick={() => edit(selected)}><Pencil aria-hidden="true" />Edit note</button>
            {confirm ? <>
              <button className="secondary-button" type="button" disabled={saving} onClick={() => void save(selected.id, null)}>Confirm delete note</button>
              <button className="secondary-button" type="button" disabled={saving} onClick={() => { setConfirm(false); setWriteError(null); }}>Cancel deletion</button>
            </> : <button className="secondary-button" type="button" disabled={saving} onClick={() => setConfirm(true)}><Trash2 aria-hidden="true" />Delete note</button>}
          </div>
          {writeError ? <p role="alert">{writeError}</p> : null}
        </> : null}
      </section> : null}
    </div>
  </>;
}
