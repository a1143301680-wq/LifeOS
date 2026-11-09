import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";

import { ApiError, getProjectTimeline } from "./api";
import ProjectLogDetail from "./ProjectLogDetail";
import ProjectTodoDetail from "./ProjectTodoDetail";
import type { TimelineEntry } from "./types";

type Props = { token: string; projectId: string; timezone: string; onUnauthorized: (message: string | null) => void; onSaved: () => Promise<void>; renderSession: (id: string, onClose: () => void, onRefresh: () => Promise<void>) => ReactNode };
const labels = { manual_log: "Log", ai_session: "AI Session", todo_completed: "Todo completed" };
const identity = (entry: TimelineEntry) => `${entry.kind}:${entry.source_id}`;

export default function ProjectTimeline(props: Props) {
  return <Timeline key={`${props.token}:${props.projectId}`} {...props} />;
}

function Timeline({ token, projectId, timezone, onUnauthorized, onSaved, renderSession }: Props) {
  const [items, setItems] = useState<TimelineEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [source, setSource] = useState<TimelineEntry | "new" | null>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const busyPage = useRef(false);
  const usedCursors = useRef(new Set<string>());
  const trigger = useRef<HTMLButtonElement | null>(null);
  const refreshButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const parentRefresh = useRef(onSaved);
  parentRefresh.current = onSaved;

  async function load(append = false, propagate = false) {
    const pageCursor = append ? cursor : null;
    if (append && (busyPage.current || pageCursor === null)) return;
    if (!append) { generation.current++; busyPage.current = false; usedCursors.current.clear(); setPageLoading(false); setPageError(false); }
    const request = generation.current;
    if (append) { busyPage.current = true; setPageLoading(true); setPageError(false); } else { setLoading(true); setError(false); }
    try {
      const page = await getProjectTimeline(token, projectId, pageCursor);
      if (!active.current || generation.current !== request) return;
      if (page.next_cursor !== null && (page.next_cursor === pageCursor || usedCursors.current.has(page.next_cursor))) throw new ApiError(0);
      if (pageCursor) usedCursors.current.add(pageCursor);
      setItems((previous) => [...new Map([...(append ? previous : []), ...page.items].map((entry) => [identity(entry), entry])).values()]);
      setCursor(page.next_cursor);
    } catch (caught) {
      if (!active.current || generation.current !== request) return;
      if (caught instanceof ApiError && caught.status === 401) onUnauthorized("Your identity expired. Enter the token again.");
      else if (append) setPageError(true); else setError(true);
      if (propagate) throw caught;
    } finally {
      if (active.current && generation.current === request) {
        if (append) { busyPage.current = false; setPageLoading(false); } else setLoading(false);
      }
    }
  }

  useEffect(() => { active.current = true; void load(); return () => { active.current = false; generation.current++; }; }, []);
  useEffect(() => {
    if (returnFocus.current && !source && !loading) {
      returnFocus.current = false;
      (trigger.current?.isConnected ? trigger.current : refreshButton.current)?.focus();
    }
  }, [items, source, loading]);

  async function closeSource() {
    returnFocus.current = true; setSource(null); await load();
  }

  async function saved() {
    if (!active.current) return;
    await Promise.all([load(false, true), parentRefresh.current()]);
  }

  return <section className="project-timeline" aria-label="Project Timeline">
    <div className="linked-todos-heading"><h3>Timeline</h3><div className="linked-todo-tools">
      <button className="secondary-button" disabled={source !== null} onClick={(event) => { trigger.current = event.currentTarget; setSource("new"); }}><Plus aria-hidden="true" />Add log</button>
      <button ref={refreshButton} className="icon-button" title="Refresh timeline" aria-label="Refresh timeline" disabled={loading || source !== null} onClick={() => void load()}><RefreshCw aria-hidden="true" /></button></div></div>
    {loading ? <p role="status">Loading timeline...</p> : null}
    {error ? <p role="alert">Could not refresh timeline.</p> : null}
    {!loading && !error && !items.length ? <p className="dashboard-empty">No activity yet</p> : null}
    <ol className="timeline-entries" aria-label="Timeline entries">{items.map((entry) => <li key={identity(entry)}>
      <div><div className="timeline-meta"><span>{labels[entry.kind]}</span><time dateTime={entry.occurred_at}>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(entry.occurred_at))}</time></div>
        <strong>{entry.title}</strong>{entry.summary ? <p>{entry.summary}</p> : null}</div>
      <button className="icon-button" title="Open timeline source" aria-label={`Open ${labels[entry.kind]} ${entry.title}`} disabled={source !== null} onClick={(event) => { trigger.current = event.currentTarget; setSource(entry); }}><ExternalLink aria-hidden="true" /></button>
    </li>)}</ol>
    {pageError ? <p role="alert">Could not load more activity.</p> : null}
    {cursor ? <button className="secondary-button" disabled={loading || pageLoading || source !== null} onClick={() => void load(true)}><RefreshCw aria-hidden="true" />{pageLoading ? "Loading activity..." : pageError ? "Retry activity page" : "Load more activity"}</button> : null}
    {source === "new" || source?.kind === "manual_log" ? <ProjectLogDetail token={token} projectId={projectId} logId={source === "new" ? null : source.source_id} onUnauthorized={onUnauthorized} onClose={() => void closeSource()} onSaved={saved} /> : null}
    {source && source !== "new" && source.kind === "todo_completed" ? <ProjectTodoDetail token={token} todoId={source.source_id} timezone={timezone} onUnauthorized={onUnauthorized} onClose={() => void closeSource()} onRefresh={async () => { await load(); }} /> : null}
    {source && source !== "new" && source.kind === "ai_session" ? renderSession(source.source_id, () => void closeSource(), async () => { await load(); }) : null}
  </section>;
}
