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

const categoriesResponse = {
  items: [
    {
      id: "69fdd37c-162d-408a-af81-9233c5c88984",
      name: "Inbox",
      color: "#64748b",
      icon: "inbox",
      is_inbox: true,
      sort_order: 0,
      created_at: "2026-07-10T18:30:00+08:00",
      updated_at: "2026-07-10T18:30:00+08:00",
    },
    {
      id: "9cfca098-c870-447a-8eb9-04dac3f92716",
      name: "Work",
      color: null,
      icon: null,
      is_inbox: false,
      sort_order: 10,
      created_at: "2026-07-11T18:30:00+08:00",
      updated_at: "2026-07-11T18:30:00+08:00",
    },
  ],
  next_cursor: null,
  server_time: "2026-07-23T08:00:00+08:00",
};

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

test("loads categories with bearer authorization and preserves server order", async () => {
  storedIdentity();
  const requests: Array<{ url: string; authorization: string | null }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    requests.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));

  const list = await screen.findByRole("list", { name: "Todo categories" });
  expect(within(list).getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
    "Inbox",
    "Work",
  ]);
  expect(within(list).getByText("Default Inbox")).toBeInTheDocument();
  expect(within(list).getByLabelText("No color")).toBeInTheDocument();
  expect(requests.at(-1)).toEqual({
    url: "/api/v1/todo-categories",
    authorization: "Bearer stored-token",
  });
});

test("opens a populated category editor and cancels without a write request", async () => {
  storedIdentity();
  const writeMethods: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method && init.method !== "GET") writeMethods.push(init.method);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));

  expect(screen.getByRole("heading", { name: "Edit Work" })).toBeInTheDocument();
  expect(screen.getByLabelText("Edit category name")).toHaveValue("Work");
  expect(screen.getByRole("radio", { name: "No color" })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));

  expect(screen.queryByRole("heading", { name: "Edit Work" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Create category" })).toBeInTheDocument();
  expect(writeMethods).toEqual([]);
});

test("updates a category with a constrained PATCH request and refreshes server order", async () => {
  storedIdentity();
  const updatedWork = {
    ...categoriesResponse.items[1],
    name: "Office",
    color: "#2563eb",
  };
  let categoryGets = 0;
  let patchRequest: {
    url: string;
    headers: Headers;
    body: Record<string, unknown>;
  } | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "PATCH") {
      patchRequest = {
        url,
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      };
      return jsonResponse({
        data: updatedWork,
        sync: { cursor: 16 },
        server_time: "2026-07-23T08:02:00+08:00",
      });
    }
    categoryGets += 1;
    return jsonResponse({
      ...categoriesResponse,
      items: categoryGets === 1
        ? categoriesResponse.items
        : [categoriesResponse.items[0], updatedWork],
    });
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));
  const nameInput = screen.getByLabelText("Edit category name");
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "  Office  ");
  await userEvent.click(screen.getByRole("radio", { name: "Blue" }));
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Category updated.")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Edit Work" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Todo categories" })).getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
    "Inbox",
    "Office",
  ]);
  expect(categoryGets).toBe(2);
  expect(patchRequest).not.toBeNull();
  expect(patchRequest!.url).toBe(`/api/v1/todo-categories/${categoriesResponse.items[1].id}`);
  expect(patchRequest!.headers.get("Authorization")).toBe("Bearer stored-token");
  expect(patchRequest!.headers.get("Idempotency-Key")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(patchRequest!.body).toEqual({ name: "Office", color: "#2563eb" });
  expect(patchRequest!.body).not.toHaveProperty("icon");
  expect(patchRequest!.body).not.toHaveProperty("sort_order");
  expect(patchRequest!.body).not.toHaveProperty("is_inbox");
  expect(patchRequest!.body).not.toHaveProperty("user_id");
});

test("reuses an edit idempotency key until a failed payload changes", async () => {
  storedIdentity();
  const patches: Array<{ key: string | null; body: Record<string, unknown> }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "PATCH") {
      patches.push({
        key: new Headers(init.headers).get("Idempotency-Key"),
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      });
      if (patches.length === 1) throw new TypeError("connection closed");
      if (patches.length === 2) return jsonResponse({ error: { code: "internal_error" } }, 503);
      return jsonResponse({
        data: { ...categoriesResponse.items[1], name: "Studio", color: null },
        sync: { cursor: 17 },
        server_time: "2026-07-23T08:03:00+08:00",
      });
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));
  const nameInput = screen.getByLabelText("Edit category name");
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "Office");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not update category");

  await userEvent.click(screen.getByRole("button", { name: "Retry save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not update category");
  expect(patches[1].key).toBe(patches[0].key);

  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "Studio");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByText("Category updated.")).toBeInTheDocument();
  expect(patches[2].key).not.toBe(patches[0].key);
  expect(patches[2].body).toEqual({ name: "Studio", color: null });
});

test("protects Inbox and cancels a named normal-category deletion without a request", async () => {
  storedIdentity();
  const deleteRequests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "DELETE") deleteRequests.push(url);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });

  expect(screen.getByRole("button", { name: "Edit Inbox" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete Inbox" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
  expect(screen.getByRole("heading", { name: "Delete Work?" })).toBeInTheDocument();
  expect(screen.getByText("Work", { selector: "strong" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cancel delete" }));

  expect(screen.queryByRole("heading", { name: "Delete Work?" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Create category" })).toBeInTheDocument();
  expect(deleteRequests).toEqual([]);
});

test("deletes a confirmed normal category without a request body and refreshes the list", async () => {
  storedIdentity();
  let categoryGets = 0;
  let deleteRequest: {
    url: string;
    headers: Headers;
    body: BodyInit | null | undefined;
  } | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "DELETE") {
      deleteRequest = {
        url,
        headers: new Headers(init.headers),
        body: init.body,
      };
      return jsonResponse({
        data: {
          id: categoriesResponse.items[1].id,
          deleted: true,
          deleted_at: "2026-07-23T08:04:00+08:00",
        },
        sync: { cursor: 18 },
        server_time: "2026-07-23T08:04:00+08:00",
      });
    }
    categoryGets += 1;
    return jsonResponse({
      ...categoriesResponse,
      items: categoryGets === 1 ? categoriesResponse.items : [categoriesResponse.items[0]],
    });
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete category" }));

  expect(await screen.findByText("Category deleted.")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Work" })).not.toBeInTheDocument();
  expect(categoryGets).toBe(2);
  expect(deleteRequest).not.toBeNull();
  expect(deleteRequest!.url).toBe(`/api/v1/todo-categories/${categoriesResponse.items[1].id}`);
  expect(deleteRequest!.headers.get("Authorization")).toBe("Bearer stored-token");
  expect(deleteRequest!.headers.get("Idempotency-Key")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(deleteRequest!.headers.get("Content-Type")).toBeNull();
  expect(deleteRequest!.body).toBeUndefined();
});

test("edits Inbox display fields without sending identity or system fields", async () => {
  storedIdentity();
  let patchRequest: { url: string; body: Record<string, unknown> } | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "PATCH") {
      patchRequest = {
        url,
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      };
      return jsonResponse({
        data: { ...categoriesResponse.items[0], name: "Home Inbox", color: null },
        sync: { cursor: 19 },
        server_time: "2026-07-23T08:05:00+08:00",
      });
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Edit Inbox" }));
  const nameInput = screen.getByLabelText("Edit category name");
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "Home Inbox");
  await userEvent.click(screen.getByRole("radio", { name: "No color" }));
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Category updated.")).toBeInTheDocument();
  expect(patchRequest!.url).toBe(`/api/v1/todo-categories/${categoriesResponse.items[0].id}`);
  expect(patchRequest!.body).toEqual({ name: "Home Inbox", color: null });
  expect(patchRequest!.body).not.toHaveProperty("is_inbox");
  expect(patchRequest!.body).not.toHaveProperty("user_id");
});

test("rejects blank and overlong edit names without a PATCH request", async () => {
  storedIdentity();
  const patches: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (init?.method === "PATCH") patches.push(url);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));
  const nameInput = screen.getByLabelText("Edit category name");

  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "   ");
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Enter a category name");

  fireEvent.change(nameInput, { target: { value: "x".repeat(121) } });
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("120 characters or fewer");
  expect(patches).toEqual([]);
});

test("reuses a delete idempotency key for an unchanged retry and renews it for a later flow", async () => {
  storedIdentity();
  const deleteKeys: Array<string | null> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "DELETE") {
      deleteKeys.push(new Headers(init.headers).get("Idempotency-Key"));
      if (deleteKeys.length === 1) throw new TypeError("connection closed");
      if (deleteKeys.length === 2) {
        return jsonResponse({ error: { code: "internal_error" } }, 503);
      }
      return jsonResponse({
        data: {
          id: categoriesResponse.items[1].id,
          deleted: true,
          deleted_at: "2026-07-23T08:06:00+08:00",
        },
        sync: { cursor: 20 },
        server_time: "2026-07-23T08:06:00+08:00",
      });
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Delete failed");

  await userEvent.click(screen.getByRole("button", { name: "Retry delete" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Delete failed");
  expect(deleteKeys[1]).toBe(deleteKeys[0]);

  await userEvent.click(screen.getByRole("button", { name: "Cancel delete" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete category" }));
  expect(await screen.findByText("Category deleted.")).toBeInTheDocument();
  expect(deleteKeys[2]).not.toBe(deleteKeys[0]);
});

test.each([
  [400, "Check the category name and try again."],
  [409, "This edit conflicts with an earlier attempt."],
] as const)("maps PATCH %i to a safe editable error", async (status, expectedMessage) => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "PATCH") {
      return jsonResponse({ error: { code: "category_write_rejected" } }, status);
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
  expect(screen.getByLabelText("Edit category name")).toHaveValue("Work");
  expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
});

test("refreshes stale category data after a PATCH 410", async () => {
  storedIdentity();
  let categoryGets = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "PATCH") {
      return jsonResponse({ error: { code: "category_deleted" } }, 410);
    }
    categoryGets += 1;
    return jsonResponse({
      ...categoriesResponse,
      items: categoryGets === 1 ? categoriesResponse.items : [categoriesResponse.items[0]],
    });
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
  expect(screen.queryByRole("heading", { name: "Edit Work" })).not.toBeInTheDocument();
  expect(categoryGets).toBe(2);
});

test.each([
  [400, "This category cannot be deleted."],
  [409, "This category conflicts with a newer change."],
] as const)("maps DELETE %i to a safe confirmation error", async (status, expectedMessage) => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "DELETE") {
      return jsonResponse({ error: { code: "category_write_rejected" } }, status);
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete category" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(expectedMessage);
  expect(screen.getByRole("heading", { name: "Delete Work?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete category" })).toBeEnabled();
});

test("refreshes stale category data after a DELETE 404", async () => {
  storedIdentity();
  let categoryGets = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "DELETE") {
      return jsonResponse({ error: { code: "category_not_found" } }, 404);
    }
    categoryGets += 1;
    return jsonResponse({
      ...categoriesResponse,
      items: categoryGets === 1 ? categoriesResponse.items : [categoriesResponse.items[0]],
    });
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
  await userEvent.click(screen.getByRole("button", { name: "Delete category" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("no longer available");
  expect(screen.queryByRole("heading", { name: "Delete Work?" })).not.toBeInTheDocument();
  expect(categoryGets).toBe(2);
});

test.each(["PATCH", "DELETE"] as const)("clears stored identity when a category %s returns 401", async (method) => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === method) {
      return jsonResponse({ error: { code: "unauthorized" } }, 401);
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  if (method === "PATCH") {
    await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
  } else {
    await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete category" }));
  }

  expect(await screen.findByText("Your identity expired. Enter the token again.")).toBeInTheDocument();
  expect(screen.getByLabelText("Identity token")).toBeInTheDocument();
  expect(localStorage.getItem("lifeos.identityToken")).toBeNull();
});

test.each(["PATCH", "DELETE"] as const)("prevents duplicate pending category %s requests", async (method) => {
  storedIdentity();
  let resolveWrite!: (response: Response) => void;
  const pendingWrite = new Promise<Response>((resolve) => {
    resolveWrite = resolve;
  });
  let writeCount = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === method) {
      writeCount += 1;
      return pendingWrite;
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  if (method === "PATCH") {
    await userEvent.click(screen.getByRole("button", { name: "Edit Work" }));
    const button = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
  } else {
    await userEvent.click(screen.getByRole("button", { name: "Delete Work" }));
    const button = screen.getByRole("button", { name: "Delete category" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Deleting..." })).toBeDisabled();
  }
  expect(writeCount).toBe(1);

  resolveWrite(jsonResponse({
    data: method === "PATCH"
      ? categoriesResponse.items[1]
      : {
          id: categoriesResponse.items[1].id,
          deleted: true,
          deleted_at: "2026-07-23T08:07:00+08:00",
        },
    sync: { cursor: 21 },
    server_time: "2026-07-23T08:07:00+08:00",
  }));
  await waitFor(() => expect(screen.getByText(method === "PATCH" ? "Category updated." : "Category deleted.")).toBeInTheDocument());
});

test("creates a trimmed category with an idempotency key and refreshes server order", async () => {
  storedIdentity();
  const createdCategory = {
    ...categoriesResponse.items[1],
    id: "b3fab414-b101-4d35-aa6e-350f92126ea3",
    name: "Health",
    color: "#16a34a",
  };
  let categoryGets = 0;
  let createRequest: { headers: Headers; body: Record<string, unknown> } | null = null;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "POST") {
      createRequest = {
        headers: new Headers(init.headers),
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      };
      return jsonResponse({
        data: createdCategory,
        sync: { cursor: 12 },
        server_time: "2026-07-23T08:01:00+08:00",
      }, 201);
    }
    categoryGets += 1;
    return jsonResponse({
      ...categoriesResponse,
      items: categoryGets === 1
        ? categoriesResponse.items
        : [categoriesResponse.items[0], createdCategory, categoriesResponse.items[1]],
    });
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  expect(await screen.findByRole("list", { name: "Todo categories" })).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Category name"), "  Health  ");
  await userEvent.click(screen.getByRole("radio", { name: "Green" }));
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));

  expect(await screen.findByText("Category created.")).toBeInTheDocument();
  expect(screen.getByLabelText("Category name")).toHaveValue("");
  expect(within(screen.getByRole("list", { name: "Todo categories" })).getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
    "Inbox",
    "Health",
    "Work",
  ]);
  expect(categoryGets).toBe(2);
  expect(createRequest).not.toBeNull();
  expect(createRequest!.headers.get("Authorization")).toBe("Bearer stored-token");
  expect(createRequest!.headers.get("Idempotency-Key")).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(createRequest!.body).toEqual({ name: "Health", color: "#16a34a" });
  expect(createRequest!.body).not.toHaveProperty("user_id");
  expect(createRequest!.body).not.toHaveProperty("is_inbox");
  expect(createRequest!.body).not.toHaveProperty("sort_order");
});

test("reuses the idempotency key when an unchanged failed create is retried", async () => {
  storedIdentity();
  const postKeys: Array<string | null> = [];
  let postAttempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "POST") {
      postAttempts += 1;
      postKeys.push(new Headers(init.headers).get("Idempotency-Key"));
      if (postAttempts === 1) throw new TypeError("connection closed");
      return jsonResponse({
        data: { ...categoriesResponse.items[1], name: "Project" },
        sync: { cursor: 13 },
        server_time: "2026-07-23T08:01:00+08:00",
      }, 201);
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  expect(await screen.findByRole("list", { name: "Todo categories" })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Category name"), "Project");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Could not create category");
  expect(screen.getByLabelText("Category name")).toHaveValue("Project");
  await userEvent.click(screen.getByRole("button", { name: "Retry create" }));

  expect(await screen.findByText("Category created.")).toBeInTheDocument();
  expect(postKeys).toHaveLength(2);
  expect(postKeys[1]).toBe(postKeys[0]);
});

test("starts a new idempotent attempt after editing a failed create payload", async () => {
  storedIdentity();
  const posts: Array<{ key: string | null; body: Record<string, unknown> }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "POST") {
      posts.push({
        key: new Headers(init.headers).get("Idempotency-Key"),
        body: JSON.parse(String(init.body)) as Record<string, unknown>,
      });
      if (posts.length === 1) return jsonResponse({ error: { code: "internal_error" } }, 503);
      return jsonResponse({
        data: { ...categoriesResponse.items[1], name: "Study" },
        sync: { cursor: 14 },
        server_time: "2026-07-23T08:01:00+08:00",
      }, 201);
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  const nameInput = screen.getByLabelText("Category name");
  await userEvent.type(nameInput, "School");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not create category");

  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "Study");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));

  expect(await screen.findByText("Category created.")).toBeInTheDocument();
  expect(posts[0].body).toEqual({ name: "School" });
  expect(posts[1].body).toEqual({ name: "Study" });
  expect(posts[1].key).not.toBe(posts[0].key);
});

test("prevents duplicate category submission while a create is pending", async () => {
  storedIdentity();
  let postCount = 0;
  let resolveCreate!: (response: Response) => void;
  const pendingCreate = new Promise<Response>((resolve) => { resolveCreate = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "POST") {
      postCount += 1;
      return pendingCreate;
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.type(screen.getByLabelText("Category name"), "Focus");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));

  const pendingButton = screen.getByRole("button", { name: "Creating..." });
  expect(pendingButton).toBeDisabled();
  await userEvent.click(pendingButton);
  expect(postCount).toBe(1);

  resolveCreate(jsonResponse({
    data: { ...categoriesResponse.items[1], name: "Focus" },
    sync: { cursor: 15 },
    server_time: "2026-07-23T08:01:00+08:00",
  }, 201));
  expect(await screen.findByText("Category created.")).toBeInTheDocument();
});

test("validates category names before sending a create request", async () => {
  storedIdentity();
  let postCount = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "POST") postCount += 1;
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  const nameInput = screen.getByLabelText("Category name");

  await userEvent.type(nameInput, "   ");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Enter a category name");

  fireEvent.change(nameInput, { target: { value: "x".repeat(121) } });
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("120 characters or fewer");
  expect(postCount).toBe(0);
});

test("shows an empty category list while keeping creation available", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    return jsonResponse({ ...categoriesResponse, items: [] });
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  expect(await screen.findByText("No categories yet")).toBeInTheDocument();
  expect(screen.getByLabelText("Category name")).toBeEnabled();
});

test("keeps identity through a recoverable category list error and retries", async () => {
  storedIdentity();
  let categoryAttempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    categoryAttempts += 1;
    if (categoryAttempts === 1) throw new TypeError("network unavailable");
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load categories");
  expect(localStorage.getItem("lifeos.identityToken")).toBe("stored-token");
  await userEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("list", { name: "Todo categories" })).toBeInTheDocument();
  expect(categoryAttempts).toBe(2);
});

test("clears identity when the category list becomes unauthorized", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    return jsonResponse({ error: { code: "unauthorized" } }, 401);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("identity expired");
  expect(localStorage.length).toBe(0);
});

test("maps category validation and idempotency conflicts without exposing backend details", async () => {
  storedIdentity();
  let postAttempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "POST") {
      postAttempts += 1;
      return postAttempts === 1
        ? jsonResponse({ error: { code: "validation_error", message: "database detail" } }, 400)
        : jsonResponse({ error: { code: "idempotency_key_conflict", message: "hash detail" } }, 409);
    }
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  const nameInput = screen.getByLabelText("Category name");
  await userEvent.type(nameInput, "Inbox");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Check the category name");
  expect(screen.queryByText("database detail")).not.toBeInTheDocument();

  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "Work");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("conflicts with an earlier attempt");
  expect(screen.queryByText("hash detail")).not.toBeInTheDocument();
});

test("clears identity and preserves no token when category creation is unauthorized", async () => {
  storedIdentity();
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/me")) return jsonResponse(meResponse);
    if (url.includes("/today")) return jsonResponse(todayResponseFor());
    if (init?.method === "POST") return jsonResponse({ error: { code: "unauthorized" } }, 401);
    return jsonResponse(categoriesResponse);
  });

  render(<App />);
  expect(await screen.findByText("Nothing scheduled")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Categories" }));
  await screen.findByRole("list", { name: "Todo categories" });
  await userEvent.type(screen.getByLabelText("Category name"), "Work");
  await userEvent.click(screen.getByRole("button", { name: "Create category" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("identity expired");
  expect(screen.getByLabelText("Identity token")).toBeInTheDocument();
  expect(localStorage.length).toBe(0);
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
