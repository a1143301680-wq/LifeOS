import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ProjectTodoDetail from "./ProjectTodoDetail";

const props = () => ({ token: "owner-token", todoId: "source", timezone: "Asia/Shanghai", onUnauthorized: vi.fn(), onClose: vi.fn() });
function response(status: number, body = {}) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }); }

test.each([404, 410])("source %s is unavailable without exposing stale content", async (status) => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response(status));
  render(<ProjectTodoDetail {...props()} />);
  expect(await screen.findByText("Todo unavailable")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /complete|edit|delete/i })).not.toBeInTheDocument();
});

test("source network error retries read-only and 401 expires identity", async () => {
  const request = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("offline")).mockResolvedValue(response(401));
  const input = props();
  render(<ProjectTodoDetail {...input} />);
  await userEvent.click(await screen.findByRole("button", { name: "Retry source" }));
  await waitFor(() => expect(input.onUnauthorized).toHaveBeenCalledOnce());
  expect(request.mock.calls.every((call) => call[1]?.method === undefined)).toBe(true);
});

test("refresh replaces live source metadata and handles subsequent deletion", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(200, { data: { id: "source", title: "Actual source", note: "Real note", category: { name: "Work", is_deleted: true }, status: "completed", priority: "high", planned_date: "2026-10-20", due_at: "2026-10-20T01:00:00Z" } })).mockResolvedValue(response(410));
  render(<ProjectTodoDetail {...props()} />);
  expect(await screen.findByText("Real note")).toBeInTheDocument();
  expect(screen.getByText("Work (deleted)")).toBeInTheDocument();
  expect(screen.getByText("2026-10-20")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Refresh source Todo" }));
  expect(await screen.findByText("Todo unavailable")).toBeInTheDocument();
  expect(screen.queryByText("Actual source")).not.toBeInTheDocument();
});
