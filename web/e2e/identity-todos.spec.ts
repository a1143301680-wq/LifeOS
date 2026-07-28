import { expect, test } from "@playwright/test";

const identity = {
  data: {
    id: "6dc20f43-14a3-45f0-b646-5077f6802586",
    alias: "me",
    display_name: "Bpn",
    timezone: "Asia/Shanghai",
  },
  server_time: "2026-07-22T14:00:00+08:00",
};

const todos = {
  items: [
    {
      id: "d26be12d-16d7-4fd1-8965-0f1fe7224595",
      category_id: "69fdd37c-162d-408a-af81-9233c5c88984",
      category: { id: "69fdd37c-162d-408a-af81-9233c5c88984", name: "Work", is_deleted: false },
      title: "Prepare weekly review without losing the important details",
      note: null,
      status: "pending",
      priority: "high",
      planned_date: "2026-07-23",
      due_at: "2026-07-23T09:30:00+08:00",
      completed_at: null,
      version: 1,
      created_at: "2026-07-22T13:00:00+08:00",
      updated_at: "2026-07-22T13:00:00+08:00",
    },
  ],
  next_cursor: null,
  server_time: "2026-07-22T14:00:00+08:00",
};

const today = {
  data: {
    date: "2026-07-23",
    timezone: "Asia/Shanghai",
    sections: {
      overdue: [{ ...todos.items[0], id: "today-overdue", title: "Overdue review notes" }],
      due: [{ ...todos.items[0], id: "today-due", title: "Prepare weekly review without losing the important details" }],
      planned: [{ ...todos.items[0], id: "today-planned", title: "Plan tomorrow's focus" }],
      inbox_recent: [{ ...todos.items[0], id: "today-inbox", title: "Inbox follow-up" }],
    },
    summary: { pending_count: 4, completed_count: 2, overdue_count: 1 },
  },
  server_time: "2026-07-23T14:00:00+08:00",
};

const inboxCategory = {
  id: "69fdd37c-162d-408a-af81-9233c5c88984",
  name: "Inbox",
  color: "#64748b",
  icon: "inbox",
  is_inbox: true,
  sort_order: 0,
  created_at: "2026-07-10T18:30:00+08:00",
  updated_at: "2026-07-10T18:30:00+08:00",
};

async function hasHorizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "narrow", width: 375, height: 812 },
]) {
  test(`${viewport.name} Today, Todos, and Categories flow fits the viewport`, async ({ page }) => {
    let categoryItems = [inboxCategory];
    let createRequest: { body: unknown; idempotencyKey: string | undefined } | null = null;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: identity }));
    await page.route("**/api/v1/todos**", (route) =>
      route.fulfill({ json: route.request().url().includes("/today") ? today : todos }),
    );
    await page.route("**/api/v1/todo-categories", async (route) => {
      if (route.request().method() === "POST") {
        createRequest = {
          body: route.request().postDataJSON(),
          idempotencyKey: route.request().headers()["idempotency-key"],
        };
        categoryItems = [
          inboxCategory,
          {
            ...inboxCategory,
            id: "b3fab414-b101-4d35-aa6e-350f92126ea3",
            name: "Health",
            color: "#16a34a",
            icon: null,
            is_inbox: false,
            sort_order: 1,
          },
        ];
        await route.fulfill({
          status: 201,
          json: {
            data: categoryItems[1],
            sync: { cursor: 12 },
            server_time: "2026-07-23T14:01:00+08:00",
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          items: categoryItems,
          next_cursor: null,
          server_time: "2026-07-23T14:00:00+08:00",
        },
      });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Connect your identity" })).toBeVisible();
    await expect(page.getByLabel("Identity token")).toHaveAttribute("type", "password");
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.getByLabel("Identity token").fill("browser-test-token");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByLabel("Selected date")).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous date" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next date" })).toBeVisible();
    await expect(page.getByLabel("Today summary")).toContainText("Completed");
    await expect(page.getByRole("heading", { name: "Overdue", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Inbox", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch identity" })).toBeVisible();

    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.getByText("Prepare weekly review without losing the important details")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh todos" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.getByRole("button", { name: "Categories" }).click();
    await expect(page.getByRole("heading", { name: "Categories" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expect(page.getByText("Default Inbox")).toBeVisible();
    await page.getByLabel("Category name").fill(" Health ");
    await page.getByRole("radio", { name: "Green" }).check();
    await page.getByRole("button", { name: "Create category" }).click();

    await expect(page.getByText("Category created.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Health" })).toBeVisible();
    expect(createRequest).not.toBeNull();
    expect(createRequest!.body).toEqual({ name: "Health", color: "#16a34a" });
    expect(createRequest!.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.getByRole("button", { name: "Today" }).click();
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  });
}
