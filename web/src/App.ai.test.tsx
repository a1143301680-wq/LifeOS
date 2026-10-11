import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./sync-session", () => ({
  SyncSession: class {
    start() {}
    stop() {}
    retry() {}
    wake() {}
  },
}));

vi.mock("./Dashboard", () => ({ default: () => null }));

import App from "./App";

const meResponse = {
  data: {
    id: "6dc20f43-14a3-45f0-b646-5077f6802586",
    alias: "me",
    display_name: "Bpn",
    timezone: "Asia/Shanghai",
  },
  server_time: "2026-09-27T08:00:00+08:00",
};

const todayResponse = {
  data: {
    date: "2026-09-27",
    timezone: "Asia/Shanghai",
    sections: { overdue: [], due: [], planned: [], inbox_recent: [] },
    summary: { pending_count: 0, completed_count: 0, overdue_count: 0 },
  },
  server_time: "2026-09-27T08:00:00+08:00",
};

const planResponse = {
  data: {
    date: "2026-09-27",
    summary: "Protect one focus block and close the handoff.",
    focus_items: [{ todo_id: "d26be12d-16d7-4fd1-8965-0f1fe7224595", reason: "It is overdue." }],
    risks: [{ todo_id: null, message: "Leave margin for interruptions." }],
    suggested_todo: {
      title: "Confirm the handoff",
      priority: "high",
      planned_date: "2026-09-27",
      category_id: null,
      reason: "Close the loop explicitly.",
    },
    usage: { model: "deepseek-flash", input_tokens: 20, output_tokens: 30, total_tokens: 50 },
  },
  server_time: "2026-09-27T08:00:00+08:00",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function storedIdentity() {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "me");
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-09-27T00:30:00Z"));
});

test("renders a plan and keeps the suggested Todo behind explicit quick-add confirmation", async () => {
  storedIdentity();
  const todoPosts: Array<Record<string, unknown>> = [];
  let planRequest: { headers: Headers; body: string } | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) return jsonResponse(todayResponse);
    if (url.endsWith("/todo-categories")) {
      return jsonResponse({ items: [], next_cursor: null, server_time: meResponse.server_time });
    }
    if (url.endsWith("/ai/today-plan")) {
      planRequest = { headers: new Headers(init?.headers), body: String(init?.body) };
      return jsonResponse(planResponse);
    }
    if (url.endsWith("/todos") && init?.method === "POST") {
      todoPosts.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return jsonResponse({
        data: { id: crypto.randomUUID(), ...todoPosts.at(-1) },
        sync: { cursor: 10 },
        server_time: meResponse.server_time,
      }, 201);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Today" }));
  await userEvent.click(await screen.findByRole("button", { name: "Plan my day" }));

  expect(await screen.findByText("Protect one focus block and close the handoff.")).toBeInTheDocument();
  expect(screen.getByText("It is overdue.")).toBeInTheDocument();
  expect(screen.getByText("Leave margin for interruptions.")).toBeInTheDocument();
  expect(planRequest).not.toBeNull();
  expect(planRequest!.headers.get("Authorization")).toBe("Bearer stored-token");
  expect(planRequest!.headers.get("Content-Type")).toBe("application/json");
  expect(JSON.parse(planRequest!.body)).toEqual({ date: "2026-09-27" });
  expect(todoPosts).toEqual([]);

  await userEvent.click(screen.getByRole("button", { name: "Review suggested todo" }));
  expect(screen.getByRole("heading", { name: "Quick add todo" })).toBeInTheDocument();
  expect(screen.getByLabelText("Todo title")).toHaveValue("Confirm the handoff");
  expect(screen.getByLabelText("Priority")).toHaveValue("high");
  expect(screen.getByLabelText("Planned date")).toHaveValue("2026-09-27");
  await userEvent.clear(screen.getByLabelText("Todo title"));
  await userEvent.type(screen.getByLabelText("Todo title"), "Edited draft");
  await userEvent.click(screen.getByRole("button", { name: "Cancel todo" }));
  expect(todoPosts).toEqual([]);

  await userEvent.click(screen.getByRole("button", { name: "Review suggested todo" }));
  await userEvent.click(screen.getByRole("button", { name: "Create todo" }));
  await waitFor(() => expect(todoPosts).toEqual([{
    title: "Confirm the handoff",
    priority: "high",
    planned_date: "2026-09-27",
  }]));
});

test("prevents duplicate planning requests and supports an explicit retry", async () => {
  storedIdentity();
  let attempts = 0;
  let releaseFirst!: (response: Response) => void;
  const first = new Promise<Response>((resolve) => { releaseFirst = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) return jsonResponse(todayResponse);
    if (url.endsWith("/ai/today-plan")) {
      attempts += 1;
      if (attempts === 1) return first;
      return jsonResponse(planResponse);
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Today" }));
  const plan = await screen.findByRole("button", { name: "Plan my day" });
  await userEvent.click(plan);
  expect(screen.getByRole("button", { name: "Planning..." })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Planning..." }));
  expect(attempts).toBe(1);
  releaseFirst(jsonResponse({ error: { code: "ai_provider_unavailable" } }, 503));

  expect(await screen.findByText("Could not create a plan. Your todos are still available.")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Retry planning" }));
  expect(await screen.findByText("Protect one focus block and close the handoff.")).toBeInTheDocument();
  expect(attempts).toBe(2);
});

test("ignores an old planning completion after the selected date changes", async () => {
  storedIdentity();
  let releasePlan!: (response: Response) => void;
  const pendingPlan = new Promise<Response>((resolve) => { releasePlan = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) {
      const requestedDate = new URL(url, "http://lifeos.local").searchParams.get("date")!;
      return jsonResponse({ ...todayResponse, data: { ...todayResponse.data, date: requestedDate } });
    }
    if (url.endsWith("/ai/today-plan")) return pendingPlan;
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Today" }));
  await userEvent.click(await screen.findByRole("button", { name: "Plan my day" }));
  fireEvent.change(screen.getByLabelText("Selected date"), { target: { value: "2026-09-28" } });
  releasePlan(jsonResponse(planResponse));

  await waitFor(() => expect(screen.getByLabelText("Selected date")).toHaveValue("2026-09-28"));
  expect(screen.queryByText("Protect one focus block and close the handoff.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Plan my day" })).toBeEnabled();
});

test("invalidates a rendered plan before opening refreshed Todo data", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) return jsonResponse(todayResponse);
    if (url.endsWith("/ai/today-plan")) return jsonResponse(planResponse);
    if (url.endsWith("/todos")) {
      return jsonResponse({ items: [], next_cursor: null, server_time: meResponse.server_time });
    }
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Today" }));
  await userEvent.click(await screen.findByRole("button", { name: "Plan my day" }));
  expect(await screen.findByText("Protect one focus block and close the handoff.")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Todos" }));
  await userEvent.click(screen.getByRole("button", { name: "Today" }));

  expect(screen.queryByText("Protect one focus block and close the handoff.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Plan my day" })).toBeEnabled();
});

test("ignores an old planning completion after switching identity", async () => {
  storedIdentity();
  let releasePlan!: (response: Response) => void;
  const pendingPlan = new Promise<Response>((resolve) => { releasePlan = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/todos/today")) return jsonResponse(todayResponse);
    if (url.endsWith("/ai/today-plan")) return pendingPlan;
    throw new Error(`Unexpected request: ${url}`);
  });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Today" }));
  await userEvent.click(await screen.findByRole("button", { name: "Plan my day" }));
  await userEvent.click(screen.getByRole("button", { name: "Switch identity" }));
  releasePlan(jsonResponse(planResponse));

  expect(await screen.findByRole("heading", { name: "Connect your identity" })).toBeInTheDocument();
  expect(screen.queryByText("Protect one focus block and close the handoff.")).not.toBeInTheDocument();
});
