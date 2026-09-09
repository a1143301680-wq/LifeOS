import { ApiError } from "./api";
import { SyncSession, type SyncSessionStatus } from "./sync-session";
import type { SyncEventStreamOptions } from "./sse-transport";
import { createEmptySyncState } from "./sync-state";

const identityId = "6dc20f43-14a3-45f0-b646-5077f6802586";

function emptyPage(nextCursor: number) {
  return {
    items: [],
    next_cursor: nextCursor,
    has_more: false,
    server_time: "2026-08-29T14:00:00+08:00",
  };
}

test("runs initial and first-open catch-up, ignores covered events, and pulls a newer target", async () => {
  const pulls: number[] = [];
  const statuses: SyncSessionStatus[] = [];
  let openOptions: SyncEventStreamOptions | null = null;
  const session = new SyncSession({
    token: "token",
    initialState: createEmptySyncState(identityId),
    pullPage: async (cursor) => {
      pulls.push(cursor);
      return emptyPage(pulls.length === 1 ? 5 : pulls.length === 2 ? 5 : 9);
    },
    persist: () => undefined,
    refresh: async () => undefined,
    openStream: async (options) => {
      openOptions = options;
      options.onOpen();
      await new Promise<never>((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
      throw new Error("unreachable");
    },
    onStatus: (status) => statuses.push(status),
    onUnauthorized: vi.fn(),
  });

  session.start();
  await vi.waitFor(() => expect(openOptions).not.toBeNull());
  await vi.waitFor(() => expect(pulls).toEqual([0, 5]));
  openOptions!.onAvailable({ type: "sync.available", latest_cursor: 4, server_time: "2026-08-29T14:00:00+08:00" });
  await Promise.resolve();
  expect(pulls).toEqual([0, 5]);
  openOptions!.onAvailable({ type: "sync.available", latest_cursor: 9, server_time: "2026-08-29T14:00:00+08:00" });
  await vi.waitFor(() => expect(pulls).toEqual([0, 5, 5]));

  expect(statuses).toContain("initial");
  expect(statuses).toContain("live");
  session.stop();
});

test("stops identity work on a pull 401 without opening a stream", async () => {
  const unauthorized = vi.fn();
  const openStream = vi.fn();
  const session = new SyncSession({
    token: "token",
    initialState: createEmptySyncState(identityId),
    pullPage: async () => { throw new ApiError(401, "unauthorized"); },
    persist: () => undefined,
    refresh: async () => undefined,
    openStream,
    onStatus: vi.fn(),
    onUnauthorized: unauthorized,
  });

  session.start();
  await vi.waitFor(() => expect(unauthorized).toHaveBeenCalledOnce());
  expect(openStream).not.toHaveBeenCalled();
});

test("pauses while offline, resumes on online, and cleans the waiter on stop", async () => {
  let online = false;
  let resumeOnline!: () => void;
  const waitForOnline = vi.fn(() => new Promise<void>((resolve) => { resumeOnline = resolve; }));
  const pulls = vi.fn(async () => emptyPage(0));
  const openStream = vi.fn(async (options: { signal: AbortSignal; onOpen: () => void }) => {
    options.onOpen();
    await new Promise<never>((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    });
    throw new Error("unreachable");
  });
  const statuses: SyncSessionStatus[] = [];
  const session = new SyncSession({
    token: "token",
    initialState: createEmptySyncState(identityId),
    pullPage: pulls,
    persist: () => undefined,
    refresh: async () => undefined,
    openStream,
    onStatus: (status) => statuses.push(status),
    onUnauthorized: vi.fn(),
    isOnline: () => online,
    waitForOnline,
  });

  session.start();
  await vi.waitFor(() => expect(waitForOnline).toHaveBeenCalledOnce());
  expect(statuses).toContain("offline");
  expect(pulls).not.toHaveBeenCalled();
  online = true;
  resumeOnline();
  await vi.waitFor(() => expect(openStream).toHaveBeenCalledOnce());
  session.stop();
});

test("uses bounded reconnect waits after recoverable stream failures", async () => {
  const waits: number[] = [];
  let openings = 0;
  const session = new SyncSession({
    token: "token",
    initialState: createEmptySyncState(identityId),
    pullPage: async () => emptyPage(0),
    persist: () => undefined,
    refresh: async () => undefined,
    openStream: async (options) => {
      openings += 1;
      if (openings === 1) throw new Error("network down");
      options.onOpen();
      await new Promise<never>((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
      throw new Error("unreachable");
    },
    onStatus: vi.fn(),
    onUnauthorized: vi.fn(),
    sleep: async (milliseconds) => { waits.push(milliseconds); },
  });

  session.start();
  await vi.waitFor(() => expect(openings).toBe(2));
  expect(waits).toEqual([1_000]);
  session.stop();
});
