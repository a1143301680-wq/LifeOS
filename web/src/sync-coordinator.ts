import {
  applySyncPage,
  emptySyncEffects,
  mergeSyncEffects,
  type SyncEffects,
} from "./sync-engine";
import type { SyncState } from "./sync-state";

type SyncCoordinatorOptions = {
  initialState: SyncState;
  pullPage: (cursor: number, signal?: AbortSignal) => Promise<unknown>;
  persist: (state: SyncState) => void;
  refresh: (effects: SyncEffects) => Promise<void>;
  signal?: AbortSignal;
};

type SyncRequest = {
  targetCursor?: number;
  force?: boolean;
  refresh?: boolean;
};

export class SyncCoordinator {
  private state: SyncState;
  private requestedTarget = 0;
  private forceRequested = false;
  private refreshRequested = false;
  private active: Promise<void> | null = null;

  constructor(private readonly options: SyncCoordinatorOptions) {
    this.state = options.initialState;
  }

  get cursor() {
    return this.state.cursor;
  }

  get currentState() {
    return this.state;
  }

  request({ targetCursor = 0, force = false, refresh = true }: SyncRequest = {}) {
    if (!Number.isInteger(targetCursor) || targetCursor < 0) {
      return Promise.reject(new Error("Sync target cursor is invalid."));
    }
    if (this.options.signal?.aborted) return Promise.reject(this.options.signal.reason);
    if (!force && targetCursor <= this.state.cursor && !this.active) return Promise.resolve();

    this.requestedTarget = Math.max(this.requestedTarget, targetCursor);
    this.forceRequested ||= force;
    this.refreshRequested ||= refresh;
    if (!this.active) {
      this.active = this.drain().finally(() => {
        this.active = null;
      });
    }
    return this.active;
  }

  private async drain() {
    let lastAttemptedTarget = -1;
    while (this.forceRequested || this.requestedTarget > this.state.cursor) {
      if (this.options.signal?.aborted) throw this.options.signal.reason;
      const target = this.requestedTarget;
      const force = this.forceRequested;
      let refresh = this.refreshRequested;
      this.forceRequested = false;
      this.refreshRequested = false;
      if (!force && target === lastAttemptedTarget) {
        throw new Error("Sync server did not reach the requested cursor.");
      }
      lastAttemptedTarget = target;

      let effects = emptySyncEffects();
      let hasMore: boolean;
      do {
        const rawPage = await this.options.pullPage(this.state.cursor, this.options.signal);
        const applied = applySyncPage(this.state, rawPage);
        this.options.persist(applied.state);
        this.state = applied.state;
        effects = mergeSyncEffects(effects, applied.effects);
        hasMore = applied.hasMore;
      } while (hasMore);

      refresh ||= this.refreshRequested;
      this.refreshRequested = false;
      if (refresh && effects.applied_count > 0) await this.options.refresh(effects);
    }
  }
}
