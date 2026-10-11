import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarDays, Copy, RefreshCw } from "lucide-react";

import { ApiError, getAISessions, getProjects, getTodayTodos } from "./api";
import { calendarDateLabel, dateInTimeZone } from "./calendar-date";
import { selectFocusedProjects } from "./dashboard-selection";
import type { AISession, Project, TodayData, UserIdentity } from "./types";

type LoadStatus = "idle" | "loading" | "ready" | "error";
type SessionState = { status: LoadStatus; latest: AISession | null };

export default function Dashboard({ token, identity, onUnauthorized, onOpenProject, onOpenSession, onOpenToday, composeContinuation }: {
  token: string;
  identity: UserIdentity;
  onUnauthorized: (message: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenSession: (projectId: string, sessionId: string) => void;
  onOpenToday: () => void;
  composeContinuation: (project: Project, session: AISession) => string;
}) {
  const activeRef = useRef(false);
  const projectRunRef = useRef(0);
  const todayRunRef = useRef(0);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatus, setProjectStatus] = useState<LoadStatus>("idle");
  const [sessions, setSessions] = useState<Record<string, SessionState>>({});
  const [today, setToday] = useState<TodayData | null>(null);
  const [todayDate, setTodayDate] = useState("");
  const [todayStatus, setTodayStatus] = useState<LoadStatus>("idle");
  const [copyFeedback, setCopyFeedback] = useState<{ id: string; failed: boolean } | null>(null);

  const handleError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized("Your identity expired. Enter the token again.");
      return true;
    }
    return false;
  }, [onUnauthorized]);

  const loadSession = useCallback(async (projectId: string, run: number) => {
    setSessions((current) => ({ ...current, [projectId]: { status: "loading", latest: null } }));
    try {
      const items = await getAISessions(token, projectId);
      if (!Array.isArray(items)) throw new Error("Invalid AI session list");
      if (!activeRef.current || projectRunRef.current !== run) return;
      setSessions((current) => ({ ...current, [projectId]: { status: "ready", latest: items[0] ?? null } }));
    } catch (error) {
      if (!activeRef.current || projectRunRef.current !== run) return;
      if (handleError(error)) return;
      setSessions((current) => ({ ...current, [projectId]: { status: "error", latest: null } }));
    }
  }, [handleError, token]);

  const loadProjects = useCallback(async () => {
    const run = ++projectRunRef.current;
    setProjectStatus("loading");
    setProjects([]);
    setSessions({});
    setCopyFeedback(null);
    try {
      const items = await getProjects(token);
      if (!Array.isArray(items)) throw new Error("Invalid project list");
      if (!activeRef.current || projectRunRef.current !== run) return;
      const focused = selectFocusedProjects(items);
      setProjects(focused);
      setProjectStatus("ready");
      for (const project of focused) void loadSession(project.id, run);
    } catch (error) {
      if (!activeRef.current || projectRunRef.current !== run) return;
      if (handleError(error)) return;
      setProjectStatus("error");
    }
  }, [handleError, loadSession, token]);

  const loadToday = useCallback(async () => {
    const run = ++todayRunRef.current;
    const date = dateInTimeZone(new Date(), identity.timezone);
    setTodayDate(date);
    setTodayStatus("loading");
    setToday(null);
    try {
      const loaded = await getTodayTodos(token, date);
      if (!activeRef.current || todayRunRef.current !== run) return;
      setToday(loaded);
      setTodayStatus("ready");
    } catch (error) {
      if (!activeRef.current || todayRunRef.current !== run) return;
      if (handleError(error)) return;
      setTodayStatus("error");
    }
  }, [handleError, identity.timezone, token]);

  useEffect(() => {
    activeRef.current = true;
    void loadProjects();
    void loadToday();
    return () => {
      activeRef.current = false;
      projectRunRef.current += 1;
      todayRunRef.current += 1;
    };
  }, [loadProjects, loadToday]);

  async function copyContinuation(project: Project, session: AISession) {
    try {
      await navigator.clipboard.writeText(composeContinuation(project, session));
      if (activeRef.current) setCopyFeedback({ id: project.id, failed: false });
    } catch {
      if (activeRef.current) setCopyFeedback({ id: project.id, failed: true });
    }
  }

  return <div className="dashboard">
    <div className="section-heading dashboard-heading">
      <div><p className="eyebrow">Your workspace</p><h1>Dashboard</h1></div>
      <button className="icon-button bordered" type="button" onClick={() => { void loadProjects(); void loadToday(); }} title="Refresh Dashboard" aria-label="Refresh Dashboard"><RefreshCw aria-hidden="true" /></button>
    </div>
    <section className="dashboard-focus" aria-labelledby="dashboard-focus-title">
      <div className="dashboard-section-title"><h2 id="dashboard-focus-title">Continue work</h2><span>Up to 3 projects</span></div>
      {projectStatus === "loading" ? <p role="status">Loading focused projects...</p> : null}
      {projectStatus === "error" ? <div className="dashboard-error" role="alert"><span>Could not load projects.</span><button className="secondary-button" type="button" onClick={() => void loadProjects()}><RefreshCw aria-hidden="true" />Retry projects</button></div> : null}
      {projectStatus === "ready" && projects.length === 0 ? <p className="dashboard-empty">No focused projects. Pin a project or start one in Projects.</p> : null}
      {projects.length ? <ol className="dashboard-projects">{projects.map((project) => {
        const sessionState = sessions[project.id];
        const session = sessionState?.latest;
        return <li className="dashboard-project" key={project.id}>
          <div className="dashboard-project-top"><div><h3>{project.name}</h3><p>{project.type} · {project.status.replace("_", " ")}</p></div><strong>{project.manual_progress}%</strong></div>
          <div className="dashboard-progress"><span style={{ width: `${project.manual_progress}%` }} /></div>
          <p className="dashboard-next"><strong>Project next step</strong><span>{project.next_step || "Not set"}</span></p>
          <button className="primary-button compact" type="button" onClick={() => onOpenProject(project.id)}>{project.type === "development" ? "Continue Development" : "Continue Progress"}<ArrowRight aria-hidden="true" /></button>
          <div className="dashboard-session">
            {sessionState?.status === "loading" || !sessionState ? <p role="status">Loading AI Session...</p> : null}
            {sessionState?.status === "error" ? <div className="dashboard-error" role="alert"><span>Could not load AI Session.</span><button className="secondary-button" type="button" onClick={() => void loadSession(project.id, projectRunRef.current)}>Retry session</button></div> : null}
            {sessionState?.status === "ready" && !session ? <p className="dashboard-empty">No AI Session yet</p> : null}
            {session ? <>
              <p className="dashboard-session-kicker">Latest AI Session</p>
              <h4>{session.goal}</h4>
              {session.completed_work ? <p><strong>Completed work</strong><span>{session.completed_work}</span></p> : null}
              <p><strong>Modified files</strong><span>{session.modified_files?.trim() || "Modified files not recorded"}</span></p>
              <p><strong>Verification result</strong><span>{session.verification_result?.trim() || "Verification not recorded"}</span></p>
              {session.remaining_issues ? <p><strong>Remaining issues</strong><span>{session.remaining_issues}</span></p> : null}
              {session.next_step ? <p><strong>Session next step</strong><span>{session.next_step}</span></p> : null}
              {session.recommended_next_prompt ? <p><strong>Recommended next prompt</strong><span>{session.recommended_next_prompt}</span></p> : null}
              <div className="dashboard-session-actions"><button className="secondary-button" type="button" onClick={() => onOpenSession(project.id, session.id)}>Open AI Session<ArrowRight aria-hidden="true" /></button><button className="secondary-button" type="button" onClick={() => void copyContinuation(project, session)}><Copy aria-hidden="true" />Copy continuation</button></div>
              {copyFeedback?.id === project.id ? <p role={copyFeedback.failed ? "alert" : "status"}>{copyFeedback.failed ? "Could not copy continuation." : "Continuation copied."}</p> : null}
            </> : null}
          </div>
        </li>;
      })}</ol> : null}
    </section>
    <section className="dashboard-today" aria-labelledby="dashboard-today-title">
      <div className="dashboard-section-title"><div><h2 id="dashboard-today-title">Today</h2><p>{todayDate ? calendarDateLabel(todayDate) : ""}</p></div><CalendarDays aria-hidden="true" /></div>
      {todayStatus === "loading" ? <p role="status">Loading today's summary...</p> : null}
      {todayStatus === "error" ? <div className="dashboard-error" role="alert"><span>Could not load today's summary.</span><button className="secondary-button" type="button" onClick={() => void loadToday()}><RefreshCw aria-hidden="true" />Retry Today</button></div> : null}
      {todayStatus === "ready" && today ? <dl className="dashboard-today-counts"><div><dt>Pending</dt><dd>{today.summary.pending_count}</dd></div><div><dt>Completed</dt><dd>{today.summary.completed_count}</dd></div><div><dt>Overdue</dt><dd>{today.summary.overdue_count}</dd></div></dl> : null}
      <button className="secondary-button" type="button" onClick={onOpenToday}>Open Today<ArrowRight aria-hidden="true" /></button>
    </section>
  </div>;
}
