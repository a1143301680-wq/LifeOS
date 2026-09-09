import { ApiError } from "./api";
import { SyncCoordinator } from "./sync-coordinator";
import type { SyncEffects } from "./sync-engine";
import {
  openSyncEventStream,
  SyncStreamError,
  type SyncEventStreamOptions,
} from "./sse-transport";
import type { SyncState } from "./sync-state";

export type SyncSessionStatus = "initial" | "live" | "reconnecting" | "offline" | "error";

type SyncSessionOptions = {
  token: string;
  initialState: SyncState;
  pullPage: (cursor: number, signal?: AbortSignal) => Promise<unknown>;
  persist: (state: SyncState) => void;
  refresh: (effects: SyncEffects) => Promise<void>;
  onStatus: (status: SyncSessionStatus) => void;
  onUnauthorized: () => void;
  openStream?: (options: SyncEventStreamOptions) => Promise<never>;
  isOnline?: () => boolean;
  waitForOnline?: (signal: AbortSignal) => Promise<void>;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};

const reconnectDelays = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

function abortError() {
  return new DOMException("Sync session stopped.", "AbortError");
}

function defaultSleep(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const complete = () => {
      cleanup();
      resolve();
    };
    const timeout = window.setTimeout(complete, milliseconds);
    const abort = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(signal.reason);
    };
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}

function defaultWaitForOnline(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("online", online);
      signal.removeEventListener("abort", abort);
    };
    const online = () => {
      cleanup();
      resolve();
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    if (signal.aborted) abort();
    else {
      window.addEventListener("online", online, { once: true });
      signal.addEventListener("abort", abort, { once: true });
    }
  });
}

function isUnauthorized(error: unknown) {
  return (error instanceof ApiError || error instanceof SyncStreamError) && error.status === 401;
}

export class SyncSession {
  private readonly controller = new AbortController();
  private readonly coordinator: SyncCoordinator;
  private readonly openStream: (options: SyncEventStreamOptions) => Promise<never>;
  private readonly isOnline: () => boolean;
  private readonly waitForOnline: (signal: AbortSignal) => Promise<void>;
  private readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private streamController: AbortController | null = null;
  private releaseRecoveryWait: (() => void) | null = null;
  private started = false;
  private unauthorizedHandled = false;

  constructor(private readonly options: SyncSessionOptions) {
    this.coordinator = new SyncCoordinator({
      initialState: options.initialState,
      pullPage: options.pullPage,
      persist: options.persist,
      refresh: options.refresh,
      signal: this.controller.signal,
    });
    this.openStream = options.openStream ?? openSyncEventStream;
    this.isOnline = options.isOnline ?? (() => navigator.onLine !== false);
    this.waitForOnline = options.waitForOnline ?? defaultWaitForOnline;
    this.sleep = options.sleep ?? defaultSleep;
  }

  get cursor() {
    return this.coordinator.cursor;
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.run();
  }

  stop() {
    if (this.controller.signal.aborted) return;
    this.controller.abort(abortError());
    this.streamController?.abort(this.controller.signal.reason);
    this.releaseRecoveryWait?.();
  }

  retry() {
    if (this.controller.signal.aborted) return;
    this.releaseRecoveryWait?.();
    this.wake(0, true);
  }

  wake(targetCursor = 0, force = false, refresh = true) {
    if (this.controller.signal.aborted || (!force && targetCursor <= this.coordinator.cursor)) return;
    void this.coordinator.request({ targetCursor, force, refresh }).catch((error: unknown) => {
      this.handlePullFailure(error);
    });
  }

  private isCurrent() {
    return !this.controller.signal.aborted;
  }

  private setStatus(status: SyncSessionStatus) {
    if (this.isCurrent()) this.options.onStatus(status);
  }

  private handleUnauthorized() {
    if (this.unauthorizedHandled) return;
    this.unauthorizedHandled = true;
    this.stop();
    this.options.onUnauthorized();
  }

  private handlePullFailure(error: unknown) {
    if (!this.isCurrent()) return;
    if (isUnauthorized(error)) {
      this.handleUnauthorized();
      return;
    }
    this.setStatus("error");
    this.streamController?.abort(error);
  }

  private async waitUntilOnline() {
    while (this.isCurrent() && !this.isOnline()) {
      this.setStatus("offline");
      await this.waitForOnline(this.controller.signal);
    }
  }

  private async waitForRecovery(milliseconds: number) {
    if (!this.isCurrent()) return;
    const waitController = new AbortController();
    const stopWait = () => waitController.abort(this.controller.signal.reason);
    this.controller.signal.addEventListener("abort", stopWait, { once: true });
    let release!: () => void;
    const manual = new Promise<void>((resolve) => {
      release = () => {
        resolve();
        waitController.abort(abortError());
      };
    });
    this.releaseRecoveryWait = release;
    try {
      const sleeper = this.sleep(milliseconds, waitController.signal).catch((error: unknown) => {
        if (waitController.signal.aborted && this.isCurrent()) return;
        throw error;
      });
      await Promise.race([sleeper, manual]);
    } finally {
      this.controller.signal.removeEventListener("abort", stopWait);
      if (!waitController.signal.aborted) waitController.abort(abortError());
      if (this.releaseRecoveryWait === release) this.releaseRecoveryWait = null;
    }
  }

  private async runInitialCatchUp() {
    while (this.isCurrent()) {
      await this.waitUntilOnline();
      if (!this.isCurrent()) return false;
      this.setStatus("initial");
      try {
        await this.coordinator.request({ force: true });
        return true;
      } catch (error) {
        if (!this.isCurrent()) return false;
        if (isUnauthorized(error)) {
          this.handleUnauthorized();
          return false;
        }
        this.setStatus("error");
        await this.waitForRecovery(reconnectDelays[0]);
      }
    }
    return false;
  }

  private async run() {
    try {
      if (!await this.runInitialCatchUp()) return;
      let reconnectAttempt = 0;
      while (this.isCurrent()) {
        await this.waitUntilOnline();
        if (!this.isCurrent()) return;

        const streamController = new AbortController();
        this.streamController = streamController;
        const stopStream = () => streamController.abort(this.controller.signal.reason);
        this.controller.signal.addEventListener("abort", stopStream, { once: true });
        try {
          await this.openStream({
            token: this.options.token,
            signal: streamController.signal,
            onOpen: () => {
              if (!this.isCurrent() || this.streamController !== streamController) return;
              reconnectAttempt = 0;
              this.setStatus("live");
              this.wake(0, true);
            },
            onAvailable: (event) => {
              if (!this.isCurrent() || this.streamController !== streamController) return;
              this.wake(event.latest_cursor);
            },
          });
        } catch (error) {
          if (!this.isCurrent()) return;
          if (isUnauthorized(error)) {
            this.handleUnauthorized();
            return;
          }
          this.setStatus(this.isOnline() ? "reconnecting" : "offline");
          const delay = reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)];
          reconnectAttempt += 1;
          await this.waitForRecovery(delay);
        } finally {
          this.controller.signal.removeEventListener("abort", stopStream);
          if (this.streamController === streamController) this.streamController = null;
        }
      }
    } catch (error) {
      if (this.isCurrent()) this.handlePullFailure(error);
    }
  }
}
