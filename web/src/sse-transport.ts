import { createParser, type EventSourceMessage } from "eventsource-parser";

import { apiUrl } from "./api";

export type SyncAvailableEvent = {
  type: "sync.available";
  latest_cursor: number;
  server_time: string;
};

export type SyncEventStreamOptions = {
  token: string;
  signal: AbortSignal;
  onOpen: () => void;
  onAvailable: (event: SyncAvailableEvent) => void;
};

export class SyncStreamError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: "http_error" | "invalid_content_type" | "missing_body" | "parse_error" | "stream_closed",
  ) {
    super("Sync event stream failed.");
    this.name = "SyncStreamError";
  }
}

function parseAvailableEvent(event: EventSourceMessage): SyncAvailableEvent | null {
  if (event.event !== "sync.available") return null;
  try {
    const value: unknown = JSON.parse(event.data);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const candidate = value as Record<string, unknown>;
    if (candidate.type !== "sync.available") return null;
    if (!Number.isInteger(candidate.latest_cursor) || Number(candidate.latest_cursor) < 0) return null;
    if (typeof candidate.server_time !== "string" || Number.isNaN(Date.parse(candidate.server_time))) return null;
    return {
      type: "sync.available",
      latest_cursor: Number(candidate.latest_cursor),
      server_time: candidate.server_time,
    };
  } catch {
    return null;
  }
}

export async function openSyncEventStream(options: SyncEventStreamOptions): Promise<never> {
  const response = await fetch(apiUrl("/sync/events"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${options.token}`,
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    },
    signal: options.signal,
  });

  if (!response.ok) throw new SyncStreamError(response.status, "http_error");
  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/event-stream")) {
    throw new SyncStreamError(response.status, "invalid_content_type");
  }
  if (!response.body) throw new SyncStreamError(response.status, "missing_body");

  let parserFailed = false;
  const parser = createParser({
    maxBufferSize: 64 * 1024,
    onEvent(event) {
      const available = parseAvailableEvent(event);
      if (available) options.onAvailable(available);
    },
    onError(error) {
      if (error.type === "max-buffer-size-exceeded") parserFailed = true;
    },
  });
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  options.onOpen();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
      if (parserFailed) throw new SyncStreamError(0, "parse_error");
    }
    parser.feed(decoder.decode());
    parser.reset({ consume: true });
    if (parserFailed) throw new SyncStreamError(0, "parse_error");
    throw new SyncStreamError(0, "stream_closed");
  } finally {
    reader.releaseLock();
  }
}
