import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ApiError, getProjects, getTodoCandidates } from "./api";
import type { NoteReference } from "./types";

export default function NotesSourcePicker({ kind, token, value, onChange, onExpired }: {
  kind: "project" | "todo";
  token: string;
  value: NoteReference | null;
  onChange: (value: NoteReference | null) => void;
  onExpired: () => void;
}) {
  const [choices, setChoices] = useState<NoteReference[]>([]);
  const [projects, setProjects] = useState<NoteReference[] | null>(null);
  const [shown, setShown] = useState(20);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const active = useRef(true);
  const inputId = useId();
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const name = kind === "project" ? "Project" : "Todo";

  async function load() {
    if (busy) return;
    if (projects) {
      setShown(shown + 20);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      if (kind === "project") {
        const [current, archived] = await Promise.all([getProjects(token), getProjects(token, "archived")]);
        if (!active.current) return;
        setProjects([...new Map([...current, ...archived].map((project) => [
          project.id, { id: project.id, label: project.name, available: true },
        ])).values()]);
      } else {
        const page = await getTodoCandidates(token, cursor);
        if (!active.current) return;
        setChoices((prior) => [...new Map([...prior, ...page.items.map((todo) => ({
          id: todo.id, label: todo.title, available: true,
        }))].map((item) => [item.id, item])).values()]);
        setCursor(page.next_cursor === cursor ? null : page.next_cursor);
      }
      setLoaded(true);
    } catch (caught) {
      if (!active.current) return;
      if (caught instanceof ApiError && caught.status === 401) onExpired();
      else setError(true);
    } finally {
      if (active.current) setBusy(false);
    }
  }

  const visible = projects ? projects.slice(0, shown) : choices;
  const items = value && !visible.some((item) => item.id === value.id) ? [value, ...visible] : visible;
  return <div className="notes-picker">
    <label htmlFor={inputId}>{name}</label>
      <select id={inputId} value={value?.id ?? ""} onChange={(event) => onChange(items.find((item) => item.id === event.target.value) ?? null)}>
        <option value="">None</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.label ?? `Unavailable ${name}`}</option>)}
      </select>
    {!loaded || cursor || (projects && shown < projects.length) ? (
      <button className="secondary-button" type="button" disabled={busy} onClick={() => void load()}>
        <ChevronDown aria-hidden="true" />{busy ? "Loading..." : error ? `Retry ${name} choices` : loaded ? `More ${name} choices` : `Load ${name} choices`}
      </button>
    ) : null}
    {error ? <p role="alert">Could not load {name} choices.</p> : null}
  </div>;
}
