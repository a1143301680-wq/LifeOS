import { useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import type { ProjectLifecycleAction } from "./types";

export default function ProjectLifecycle({ archived, busy, error, onAction }: {
  archived: boolean;
  busy: boolean;
  error: boolean;
  onAction: (action: ProjectLifecycleAction) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);

  return <div className="project-lifecycle">
    {archived ? <>
      <button className="secondary-button" type="button" disabled={busy || confirm} onClick={() => void onAction("restore")}><ArchiveRestore aria-hidden="true" />Restore</button>
      {!confirm ? <button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirm(true)}><Trash2 aria-hidden="true" />Delete project</button> : null}
    </> : <button className="secondary-button" type="button" disabled={busy} onClick={() => void onAction("archive")}><Archive aria-hidden="true" />Archive</button>}
    {confirm ? <div className="project-delete-confirm" role="group" aria-label="Confirm project deletion">
      <p>Delete this project? Linked Todos are kept.</p>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => void onAction("delete")}><Trash2 aria-hidden="true" />Confirm delete project</button>
      <button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirm(false)}>Cancel deletion</button>
    </div> : null}
    {busy ? <span role="status">Saving project...</span> : null}
    {error && !busy ? <p role="alert">Could not change project visibility. Try again.</p> : null}
  </div>;
}
