import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

const meResponse = {
  data: {
    id: "6dc20f43-14a3-45f0-b646-5077f6802586",
    alias: "me",
    display_name: "Bpn",
    timezone: "Asia/Shanghai",
  },
  server_time: "2026-07-23T08:00:00+08:00",
};

const todosResponse = {
  items: [],
  next_cursor: null,
  server_time: "2026-07-23T08:00:00+08:00",
};

const todo = {
  id: "d26be12d-16d7-4fd1-8965-0f1fe7224595",
  category_id: "69fdd37c-162d-408a-af81-9233c5c88984",
  category: {
    id: "69fdd37c-162d-408a-af81-9233c5c88984",
    name: "Work",
    is_deleted: false,
  },
  title: "Prepare weekly review",
  note: null,
  status: "pending",
  priority: "high",
  planned_date: "2026-07-23",
  due_at: "2026-07-23T09:30:00+08:00",
  completed_at: null,
  version: 1,
  created_at: "2026-07-22T13:00:00+08:00",
  updated_at: "2026-07-22T13:00:00+08:00",
};

const populatedTodosResponse = { ...todosResponse, items: [todo] };

function todoWith(id: string, title: string) {
  return { ...todo, id, title };
}

function todayResponseFor(date = "2026-07-23") {
  return {
    data: {
      date,
      timezone: "Asia/Shanghai",
      sections: {
        overdue: [],
        due: [],
        planned: [],
        inbox_recent: [],
      },
      summary: {
        pending_count: 0,
        completed_count: 0,
        overdue_count: 0,
      },
    },
    server_time: "2026-07-23T08:00:00+08:00",
  };
}

const populatedTodayResponse = {
  ...todayResponseFor(),
  data: {
    ...todayResponseFor().data,
    sections: {
      overdue: [todoWith("todo-1", "Overdue first"), todoWith("todo-2", "Overdue second")],
      due: [todoWith("todo-3", "Due today")],
      planned: [todoWith("todo-4", "Planned today")],
      inbox_recent: [todoWith("todo-5", "Inbox recent")],
    },
    summary: {
      pending_count: 5,
      completed_count: 2,
      overdue_count: 2,
    },
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function storedIdentity() {
  localStorage.setItem("lifeos.identityToken", "stored-token");
  localStorage.setItem("lifeos.selectedIdentityAlias", "stale-display-only-alias");
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-07-22T16:30:00Z"));
});

test("opens Today using the current calendar date in the resolved identity timezone", async () => {
  storedIdentity();
  const requests: Array<{ url: string; authorization: string | null }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    requests.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    return url.endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(todayResponseFor());
  });

  render(<App />);

  expect(await screen.findByRole("heading", { name: "Today" })).toBeInTheDocument();
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-07-23");
  expect(requests).toEqual([
    { url: "/api/v1/me", authorization: "Bearer stored-token" },
    { url: "/api/v1/todos/today?date=2026-07-23", authorization: "Bearer stored-token" },
  ]);
  expect(requests.every(({ url }) => !url.includes("stored-token") && !url.includes("user_id"))).toBe(true);
});

test("validates a submitted token before storing the resolved identity", async () => {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    requests.push(url);
    return url.endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(todayResponseFor());
  });

  render(<App />);
  await userEvent.type(screen.getByLabelText("Identity token"), "local-test-token");
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));

  expect(await screen.findByText("Bpn")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBe("local-test-token");
  expect(localStorage.getItem("lifeos.selectedIdentityAlias")).toBe("me");
  expect(localStorage.length).toBe(2);
  expect(requests).toEqual(["/api/v1/me", "/api/v1/todos/today?date=2026-07-23"]);
});

test("renders Today summary and all four sections in server order", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(populatedTodayResponse),
  );

  render(<App />);

  const summary = await screen.findByLabelText("Today summary");
  expect(within(summary).getByText("5")).toBeInTheDocument();
  expect(within(summary).getAllByText("2", { selector: "strong" })).toHaveLength(2);
  expect(within(screen.getByRole("list", { name: "Overdue todos" })).getAllByRole("heading").map((item) => item.textContent)).toEqual([
    "Overdue first",
    "Overdue second",
  ]);
  expect(screen.getByRole("list", { name: "Due todos" })).toHaveTextContent("Due today");
  expect(screen.getByRole("list", { name: "Planned todos" })).toHaveTextContent("Planned today");
  expect(screen.getByRole("list", { name: "Recent Inbox todos" })).toHaveTextContent("Inbox recent");
  expect(screen.queryAllByText("No items")).toHaveLength(0);
});

test("keeps empty Today sections visible when another section has items", async () => {
  storedIdentity();
  const partialToday = {
    ...todayResponseFor(),
    data: {
      ...todayResponseFor().data,
      sections: {
        ...todayResponseFor().data.sections,
        overdue: [todoWith("todo-partial", "Only overdue item")],
      },
      summary: { pending_count: 1, completed_count: 0, overdue_count: 1 },
    },
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(partialToday),
  );

  render(<App />);

  expect(await screen.findByText("Only overdue item")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /^Due$/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /^Planned$/ })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /^Recent Inbox$/ })).toBeInTheDocument();
  expect(screen.getAllByText("No items")).toHaveLength(3);
});

test("navigates previous, next, direct, and current identity dates without drift", async () => {
  storedIdentity();
  const todayUrls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    todayUrls.push(url);
    const date = new URL(url, "http://lifeos.local").searchParams.get("date")!;
    return jsonResponse(todayResponseFor(date));
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Previous date" }));
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-07-22");
  await userEvent.click(screen.getByRole("button", { name: "Next date" }));
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-07-23");
  fireEvent.change(screen.getByLabelText("Selected date"), { target: { value: "2026-08-01" } });
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-08-01");
  await userEvent.click(screen.getByRole("button", { name: "Return to today" }));
  expect(screen.getByLabelText("Selected date")).toHaveValue("2026-07-23");

  expect(todayUrls).toEqual([
    "/api/v1/todos/today?date=2026-07-23",
    "/api/v1/todos/today?date=2026-07-22",
    "/api/v1/todos/today?date=2026-07-23",
    "/api/v1/todos/today?date=2026-08-01",
    "/api/v1/todos/today?date=2026-07-23",
  ]);
});

test("switches between Today and the existing pending Todo list", async () => {
  storedIdentity();
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url === "/api/v1/todos") return jsonResponse(populatedTodosResponse);
    return jsonResponse(populatedTodayResponse);
  });

  render(<App />);
  expect(await screen.findByText("Overdue first")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Todos" }));
  expect(await screen.findByText("Prepare weekly review")).toBeInTheDocument();
  expect(screen.getByText("High priority")).toBeInTheDocument();
  expect(screen.getByText("Jul 23")).toBeInTheDocument();
  expect(screen.getByText("9:30 AM")).toBeInTheDocument();
  expect(screen.getByText("Work")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Today" }));
  expect(screen.getByText("Overdue first")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBe("stored-token");
  expect(requests.filter((url) => url === "/api/v1/todos")).toHaveLength(1);
});

test("shows identity and Today loading as separate states", async () => {
  storedIdentity();
  let resolveToday!: (value: Response) => void;
  const pendingToday = new Promise<Response>((resolve) => { resolveToday = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me") ? jsonResponse(meResponse) : pendingToday,
  );

  render(<App />);
  expect(screen.getByText("Checking your identity...")).toBeInTheDocument();
  expect(await screen.findByText("Loading Today...")).toBeInTheDocument();
  expect(screen.getByText("Bpn")).toBeInTheDocument();
  resolveToday(jsonResponse(todayResponseFor()));
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
});

test("keeps identity through a recoverable Today error and retries", async () => {
  storedIdentity();
  let attempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/me")) return jsonResponse(meResponse);
    attempts += 1;
    if (attempts === 1) throw new TypeError("network unavailable");
    return jsonResponse(todayResponseFor());
  });

  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load Today");
  expect(localStorage.getItem("lifeos.identityToken")).toBe("stored-token");
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  expect(attempts).toBe(2);
});

test("clears identity when Today becomes unauthorized", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me")
      ? jsonResponse(meResponse)
      : jsonResponse({ error: { code: "unauthorized" } }, 401),
  );

  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("identity expired");
  expect(screen.getByLabelText("Identity token")).toBeInTheDocument();
  expect(localStorage.length).toBe(0);
});

test("clears stored identity after an unauthorized validation response", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: { code: "unauthorized" } }, 401));

  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("not valid");
  expect(localStorage.length).toBe(0);
});

test("preserves and retries a stored token when identity validation cannot connect", async () => {
  storedIdentity();
  let attempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    if (String(input).endsWith("/me")) {
      attempts += 1;
      if (attempts === 1) throw new TypeError("network unavailable");
      return jsonResponse(meResponse);
    }
    return jsonResponse(todayResponseFor());
  });

  render(<App />);
  expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBe("stored-token");
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  expect(attempts).toBe(2);
});

test("keeps identity through a recoverable Todo error and retries the list", async () => {
  storedIdentity();
  let todoAttempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    todoAttempts += 1;
    if (todoAttempts === 1) throw new TypeError("network unavailable");
    return jsonResponse(populatedTodosResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Todos" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load todos");
  expect(localStorage.getItem("lifeos.identityToken")).toBe("stored-token");
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Prepare weekly review")).toBeInTheDocument();
  expect(todoAttempts).toBe(2);
});

test("clears identity when the Todo list request becomes unauthorized", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    return jsonResponse({ error: { code: "unauthorized" } }, 401);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Todos" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("identity expired");
  expect(localStorage.length).toBe(0);
});

test("switching identity clears storage from an empty Today view", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
    String(input).endsWith("/me") ? jsonResponse(meResponse) : jsonResponse(todayResponseFor()),
  );

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Switch identity" }));
  expect(screen.getByLabelText("Identity token")).toHaveValue("");
  expect(localStorage.length).toBe(0);
});
