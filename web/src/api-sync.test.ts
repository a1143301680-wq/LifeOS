import { getSyncChanges } from "./api";

test("pulls sync changes with encoded cursor/limit and bearer auth only", async () => {
  const requests: Array<{ url: string; headers: Headers }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response(JSON.stringify({
      items: [],
      next_cursor: 21,
      has_more: false,
      server_time: "2026-08-29T14:00:00+08:00",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  await expect(getSyncChanges("private-token", 12, 500)).resolves.toMatchObject({ next_cursor: 21 });
  expect(requests[0].url).toBe("/api/v1/sync/changes?cursor=12&limit=500");
  expect(requests[0].url).not.toContain("private-token");
  expect(requests[0].headers.get("Authorization")).toBe("Bearer private-token");
  expect(requests[0].headers.has("user_id")).toBe(false);
});
