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

async function hasHorizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "narrow", width: 375, height: 812 },
]) {
  test(`${viewport.name} identity-to-list flow fits the viewport`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.route("**/api/v1/me", (route) => route.fulfill({ json: identity }));
    await page.route("**/api/v1/todos", (route) => route.fulfill({ json: todos }));

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Connect your identity" })).toBeVisible();
    await expect(page.getByLabel("Identity token")).toHaveAttribute("type", "password");
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await page.getByLabel("Identity token").fill("browser-test-token");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText("Prepare weekly review without losing the important details")).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch identity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh todos" })).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
}
