import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectStages from "./ProjectStages";
import type { ProjectStageCollection } from "./types";

const stageA = "00000000-0000-4000-8000-000000000001";
const stageB = "00000000-0000-4000-8000-000000000002";
const projectA = "00000000-0000-4000-8000-000000000011";
const projectB = "00000000-0000-4000-8000-000000000012";
const initial: ProjectStageCollection = {
  stages: [{ id: stageA, name: "Planning", sort_order: 0 }, { id: stageB, name: "Action", sort_order: 1 }],
  current_stage_id: null, project_version: 1,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderStages(projectId = projectA) {
  const onSaved = vi.fn();
  const onUnauthorized = vi.fn();
  return { ...render(<ProjectStages key={projectId} token="owner-token" projectId={projectId} onSaved={onSaved} onUnauthorized={onUnauthorized} />), onSaved, onUnauthorized };
}

test("edits order, names and current selection, then reads saved state", async () => {
  let stored = initial;
  const writes: Array<{ headers: Headers; body: { stages: Array<{ id: string; name: string }>; current_stage_id: string | null } }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as typeof writes[number]["body"];
      writes.push({ headers: new Headers(init.headers), body });
      stored = { stages: body.stages.map((stage, sort_order) => ({ ...stage, sort_order })), current_stage_id: body.current_stage_id, project_version: 2 };
    }
    return json({ data: stored });
  });
  const { onSaved } = renderStages();
  expect(await screen.findByText("Current: No current stage")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Edit stages" }));
  await userEvent.click(screen.getByRole("button", { name: "Move stage 2 up" }));
  await userEvent.clear(screen.getByRole("textbox", { name: "Stage 1 name" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Stage 1 name" }), "Doing");
  await userEvent.selectOptions(screen.getByLabelText("Current stage"), stageB);
  await userEvent.click(screen.getByRole("button", { name: "Save stages" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(screen.getByText("Current: Doing")).toBeInTheDocument();
  expect(within(screen.getByRole("list")).getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Doing", "Planning"]);
  expect(writes).toHaveLength(1);
  expect(writes[0].headers.get("Authorization")).toBe("Bearer owner-token");
  expect(writes[0].headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/i);
  expect(writes[0].body).toEqual({ stages: [{ id: stageB, name: "Doing" }, { id: stageA, name: "Planning" }], current_stage_id: stageB });

  await userEvent.click(screen.getByRole("button", { name: "Edit stages" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove stage 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByText("Current: Doing")).toBeInTheDocument();
  expect(screen.getByText("Planning")).toBeInTheDocument();
});

test("ambiguous failure preserves draft and key; changed payload receives a new key", async () => {
  const attempts: Array<{ key: string | null; body: string }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") {
      attempts.push({ key: new Headers(init.headers).get("Idempotency-Key"), body: String(init.body) });
      if (attempts.length < 3) throw new Error("disconnected");
      const body = JSON.parse(String(init.body)) as { stages: Array<{ id: string; name: string }> };
      return json({ data: { stages: body.stages.map((stage, sort_order) => ({ ...stage, sort_order })), current_stage_id: null, project_version: 2 } });
    }
    return json({ data: initial });
  });
  renderStages();
  await userEvent.click(await screen.findByRole("button", { name: "Edit stages" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove stage 2" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove stage 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Save stages" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save stages");
  await userEvent.click(screen.getByRole("button", { name: "Save stages" }));
  await waitFor(() => expect(attempts).toHaveLength(2));
  expect(attempts[0]).toEqual(attempts[1]);
  await userEvent.click(screen.getByRole("button", { name: "Add stage" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Stage 1 name" }), "New");
  await userEvent.click(screen.getByRole("button", { name: "Save stages" }));
  await waitFor(() => expect(attempts).toHaveLength(3));
  expect(attempts[2].key).not.toBe(attempts[1].key);
  expect(await screen.findByText("New")).toBeInTheDocument();
});

test("ignores a previous project response after switching project", async () => {
  let resolveOld: ((value: Response) => void) | undefined;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).includes(projectA)) return new Promise<Response>((resolve) => { resolveOld = resolve; });
    return json({ data: { stages: [{ id: stageB, name: "New project stage", sort_order: 0 }], current_stage_id: null, project_version: 1 } });
  });
  const onUnauthorized = vi.fn();
  const onSaved = vi.fn();
  const view = render(<ProjectStages key={projectA} token="owner-token" projectId={projectA} onSaved={onSaved} onUnauthorized={onUnauthorized} />);
  view.rerender(<ProjectStages key={projectB} token="owner-token" projectId={projectB} onSaved={onSaved} onUnauthorized={onUnauthorized} />);
  expect(await screen.findByText("New project stage")).toBeInTheDocument();
  resolveOld?.(json({ data: initial }));
  await waitFor(() => expect(screen.queryByText("Planning")).not.toBeInTheDocument());
});

test("loading failure retries independently; removing current stage clears selection", async () => {
  let reads = 0;
  const writes: Array<{ stages: Array<{ id: string; name: string }>; current_stage_id: string | null }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as typeof writes[number];
      writes.push(body);
      return json({ data: { stages: body.stages.map((stage, sort_order) => ({ ...stage, sort_order })), current_stage_id: body.current_stage_id, project_version: 2 } });
    }
    reads += 1;
    if (reads === 1) throw new Error("offline");
    return json({ data: { ...initial, current_stage_id: stageA } });
  });
  renderStages();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load stages");
  await userEvent.click(screen.getByRole("button", { name: "Retry stages" }));
  expect(await screen.findByText("Current: Planning")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Edit stages" }));
  await userEvent.click(screen.getByRole("button", { name: "Remove stage 1" }));
  expect(screen.getByLabelText("Current stage")).toHaveValue("");
  await userEvent.click(screen.getByRole("button", { name: "Save stages" }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0].current_stage_id).toBeNull();
  expect(await screen.findByText("Current: No current stage")).toBeInTheDocument();
});
