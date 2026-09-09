import { openSyncEventStream, SyncStreamError } from "./sse-transport";

function eventStream(...chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

test("opens a bearer-authenticated fetch stream and emits only valid sync.available events", async () => {
  const requests: Array<{ url: string; headers: Headers; signal: AbortSignal | null | undefined }> = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers), signal: init?.signal });
    return new Response(eventStream(
      ": keepalive\n\n",
      "event: ignored\ndata: {\"type\":\"sync.available\",\"latest_cursor\":5,\"server_time\":\"2026-08-29T14:00:00+08:00\"}\n\n",
      "event: sync.available\ndata: not-json\n\n",
      "event: sync.available\ndata: {\"type\":\"sync.available\",\"latest_cursor\":-1,\"server_time\":\"bad\"}\n\n",
      "event: sync.available\ndata: {\"type\":\"sync.available\",\"latest_cursor\":12,\"server_time\":\"2026-08-29T14:00:00+08:00\"}\n\n",
    ), { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
  });
  const opened = vi.fn();
  const available = vi.fn();

  await expect(openSyncEventStream({
    token: "private-token",
    signal: new AbortController().signal,
    onOpen: opened,
    onAvailable: available,
  })).rejects.toMatchObject({ code: "stream_closed" });

  expect(opened).toHaveBeenCalledOnce();
  expect(available).toHaveBeenCalledWith({
    type: "sync.available",
    latest_cursor: 12,
    server_time: "2026-08-29T14:00:00+08:00",
  });
  expect(available).toHaveBeenCalledOnce();
  expect(requests[0].url).toBe("/api/v1/sync/events");
  expect(requests[0].url).not.toContain("private-token");
  expect(requests[0].headers.get("Authorization")).toBe("Bearer private-token");
  expect(requests[0].headers.get("Accept")).toBe("text/event-stream");
  expect(requests[0].signal).toBeInstanceOf(AbortSignal);
});

test("reports unauthorized and invalid content types without opening", async () => {
  const opened = vi.fn();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));

  await expect(openSyncEventStream({
    token: "token",
    signal: new AbortController().signal,
    onOpen: opened,
    onAvailable: vi.fn(),
  })).rejects.toEqual(expect.objectContaining<Partial<SyncStreamError>>({ status: 401 }));
  await expect(openSyncEventStream({
    token: "token",
    signal: new AbortController().signal,
    onOpen: opened,
    onAvailable: vi.fn(),
  })).rejects.toMatchObject({ code: "invalid_content_type" });
  expect(opened).not.toHaveBeenCalled();
});

test("passes abort ownership to fetch", async () => {
  const controller = new AbortController();
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  }));

  const stream = openSyncEventStream({
    token: "token",
    signal: controller.signal,
    onOpen: vi.fn(),
    onAvailable: vi.fn(),
  });
  controller.abort(new DOMException("Stopped", "AbortError"));

  await expect(stream).rejects.toMatchObject({ name: "AbortError" });
});
