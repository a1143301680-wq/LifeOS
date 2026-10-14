import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectMilestones from "./ProjectMilestones";
import type { MilestoneCollection, MilestonePayload } from "./types";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const stamp = "2026-10-14T00:00:00Z";
function collection(rows: MilestonePayload[], version = 1): MilestoneCollection {
  return { milestones: rows.map((row, sort_order) => ({ ...row, sort_order, version: 1, created_at: stamp, updated_at: stamp })), project_version: version };
}
const initial = collection([{ id: a, title: "First", target_date: "2028-02-29", status: "pending" }, { id: b, title: "Second", target_date: null, status: "canceled" }]);
function json(data: unknown, status = 200) { return new Response(JSON.stringify({ data }), { status, headers: { "Content-Type": "application/json" } }); }
function props() { return { token: "owner-token", projectId: "project-a", onSaved: vi.fn().mockResolvedValue(undefined), onUnauthorized: vi.fn() }; }
function deferred() { let resolve!: (response: Response) => void; const promise = new Promise<Response>((done) => { resolve = done; }); return { promise, resolve }; }

test("edits title/date/status/order, clears date, saves canonical data and cancels a removal", async () => {
  let stored = initial;
  const writes: Array<{ key: string | null; body: { milestones: MilestonePayload[] } }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      writes.push({ key: new Headers(init.headers).get("Idempotency-Key"), body });
      stored = collection(body.milestones, 2);
    }
    return json(stored);
  });
  const inputProps = props();
  render(<ProjectMilestones {...inputProps} />);
  expect(await screen.findByText("2028-02-29")).toBeInTheDocument();
  expect(screen.getByText("canceled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Edit milestones" }));
  await userEvent.clear(screen.getByLabelText("Milestone 1 title"));
  await userEvent.type(screen.getByLabelText("Milestone 1 title"), " Demo ");
  await userEvent.click(screen.getByRole("button", { name: "Clear milestone 1 date" }));
  await userEvent.selectOptions(screen.getByLabelText("Milestone 1 status"), "completed");
  await userEvent.click(screen.getByRole("button", { name: "Move milestone 2 up" }));
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  await waitFor(() => expect(inputProps.onSaved).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit milestones" })).toBeEnabled());
  expect(writes[0].body.milestones.map((row) => row.id)).toEqual([b, a]);
  expect(writes[0].body.milestones[1]).toEqual({ id: a, title: "Demo", target_date: null, status: "completed" });
  expect(writes[0].key).toMatch(/^[0-9a-f-]{36}$/i);
  await userEvent.click(screen.getByRole("button", { name: "Edit milestones" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove milestone 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByText("Second")).toBeInTheDocument();
  expect(writes).toHaveLength(1);
});

test("new row keeps its UUID, date and retry key through ambiguous failures; changed payload uses new key", async () => {
  const attempts: Array<{ key: string | null; rows: MilestonePayload[] }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") {
      attempts.push({ key: new Headers(init.headers).get("Idempotency-Key"), rows: JSON.parse(String(init.body)).milestones });
      throw new Error("offline");
    }
    return json(collection([]));
  });
  render(<ProjectMilestones {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit milestones" }));
  await userEvent.click(screen.getByRole("button", { name: "Add milestone" }));
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  expect(attempts).toHaveLength(0);
  await userEvent.type(screen.getByLabelText("Milestone 1 title"), "Target");
  await userEvent.type(screen.getByLabelText("Milestone 1 target date"), "2028-02-29");
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save milestones");
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  await waitFor(() => expect(attempts).toHaveLength(2));
  expect(attempts[0]).toEqual(attempts[1]);
  expect(attempts[0].rows[0].target_date).toBe("2028-02-29");
  expect(attempts[0].rows[0].status).toBe("pending");
  await userEvent.selectOptions(screen.getByLabelText("Milestone 1 status"), "canceled");
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  await waitFor(() => expect(attempts).toHaveLength(3));
  expect(attempts[2].key).not.toBe(attempts[1].key);
  expect(attempts[2].rows[0].id).toBe(attempts[0].rows[0].id);
});

test("successful write followed by readback failure retries only reads", async () => {
  let reads = 0;
  let writes = 0;
  const saved = collection([{ id: a, title: "Saved", target_date: null, status: "completed" }], 2);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") { writes++; return json(saved); }
    reads++;
    if (reads === 2) throw new Error("read failed");
    return json(reads > 2 ? saved : initial);
  });
  render(<ProjectMilestones {...props()} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit milestones" }));
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Milestones saved. Could not refresh");
  expect(screen.getByText("Saved")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Refresh milestones" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(writes).toBe(1);
  expect(reads).toBe(3);
});

test.each(["read", "write", "readback"].flatMap((phase) => ["identity", "project"].map((switchKind) => ({ phase, switchKind }))))("ignores delayed $phase after $switchKind switch", async ({ phase, switchKind }) => {
  const pending = deferred();
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    if (String(input).includes("project-b") || new Headers(init?.headers).get("Authorization") === "Bearer partner-token") return json(collection([{ id: b, title: "Other identity", target_date: null, status: "pending" }]));
    if (init?.method === "PUT") return phase === "write" ? pending.promise : json(initial);
    reads++;
    if (phase === "read" || (phase === "readback" && reads > 1)) return pending.promise;
    return json(initial);
  });
  const first = props();
  const view = render(<ProjectMilestones {...first} />);
  if (phase !== "read") {
    await userEvent.click(await screen.findByRole("button", { name: "Edit milestones" }));
    await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
    if (phase === "readback") await waitFor(() => expect(reads).toBe(2));
  }
  view.rerender(<ProjectMilestones {...props()} token={switchKind === "identity" ? "partner-token" : "owner-token"} projectId={switchKind === "project" ? "project-b" : "project-a"} />);
  expect(await screen.findByText("Other identity")).toBeInTheDocument();
  await act(async () => pending.resolve(json(initial)));
  expect(screen.queryByText("First")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Milestone 1 title")).not.toBeInTheDocument();
  if (phase === "write") expect(first.onSaved).not.toHaveBeenCalled();
});

test("parent readback failure after save remains a refresh-only failure", async () => {
  let writes = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") writes++;
    return json(initial);
  });
  const inputProps = props();
  inputProps.onSaved.mockRejectedValueOnce(new Error("parent readback failed"));
  render(<ProjectMilestones {...inputProps} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit milestones" }));
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Milestones saved. Could not refresh");
  await userEvent.click(screen.getByRole("button", { name: "Refresh milestones" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(inputProps.onSaved).toHaveBeenCalledTimes(2);
  expect(writes).toBe(1);
});

test("initial read retries and clear-all persists", async () => {
  let reads = 0;
  let stored = initial;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") { stored = collection([]); return json(stored); }
    reads++;
    if (reads === 1) throw new Error("offline");
    return json(stored);
  });
  render(<ProjectMilestones {...props()} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load milestones");
  await userEvent.click(screen.getByRole("button", { name: "Refresh milestones" }));
  await userEvent.click(await screen.findByRole("button", { name: "Edit milestones" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove milestone 2" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove milestone 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  expect(await screen.findByText("No milestones")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit milestones" })).toBeEnabled());
});

test("expired identity and deterministic conflicts use the expected recovery paths", async () => {
  const keys: Array<string | null> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") {
      keys.push(new Headers(init.headers).get("Idempotency-Key"));
      return json(null, keys.length === 1 ? 409 : 401);
    }
    return json(initial);
  });
  const inputProps = props();
  render(<ProjectMilestones {...inputProps} />);
  await userEvent.click(await screen.findByRole("button", { name: "Edit milestones" }));
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Review the draft");
  await userEvent.click(screen.getByRole("button", { name: "Save milestones" }));
  await waitFor(() => expect(inputProps.onUnauthorized).toHaveBeenCalledOnce());
  expect(keys[0]).not.toBe(keys[1]);
});
