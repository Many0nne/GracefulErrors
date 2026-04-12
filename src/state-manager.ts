import type {
  AppError,
  ErrorSlot,
  ErrorStateManager,
  StateListener,
  UIAction,
} from "./types";

export interface StateManagerConfig<TCode extends string> {
  maxConcurrent?: number; // default: 3
  maxQueue?: number; // default: 25
  dedupeWindow?: number; // ms, default: 300
  onDropped?: (
    error: AppError<TCode>,
    reason: "dedupe" | "ttl_expired" | "queue_overflow",
  ) => void;
}

export function createStateManager<TCode extends string = string>(
  config: StateManagerConfig<TCode>,
): ErrorStateManager<TCode> {
  const maxConcurrent = config.maxConcurrent ?? 3;
  const maxQueue = config.maxQueue ?? 25;
  const dedupeWindow = config.dedupeWindow ?? 300;
  const { onDropped } = config;

  type InternalSlot = ErrorSlot<TCode> & {
    ttl?: number;
    _pendingAction?: UIAction;
  };

  const activeSlots = new Map<string, InternalSlot>();
  const queue: InternalSlot[] = [];
  const dedupeMap = new Map<string, number>();
  const dedupeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const ttlTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const listeners = new Set<StateListener<TCode>>();

  function notify(event: Parameters<StateListener<TCode>>[0]): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        if (process.env["NODE_ENV"] !== "production") {
          console.error("[gracefulerrors] StateManager listener threw:", err);
        }
      }
    }
  }

  function promoteFromQueue(): void {
    if (queue.length > 0 && activeSlots.size < maxConcurrent) {
      const next = queue.shift()!;
      activateSlot(next, next._pendingAction as UIAction);
    }
  }

  function activateSlot(slot: InternalSlot, action: UIAction): void {
    slot.state = "ACTIVE";
    activeSlots.set(slot.fingerprint, slot);

    // Start TTL timer if configured
    const ttl = slot.ttl;
    if (ttl != null && ttl > 0) {
      const timer = setTimeout(() => {
        if (activeSlots.has(slot.fingerprint)) {
          slot.state = "EXPIRED";
          activeSlots.delete(slot.fingerprint);
          ttlTimers.delete(slot.fingerprint);
          onDropped?.(slot.error, "ttl_expired");
          notify({ type: "ERROR_CLEARED", code: slot.error.code });
          promoteFromQueue();
        }
      }, ttl);
      ttlTimers.set(slot.fingerprint, timer);
    }

    notify({ type: "ERROR_ADDED", error: slot.error, action });
  }

  function isDuplicate(fingerprint: string, now: number): boolean {
    const lastSeen = dedupeMap.get(fingerprint);
    if (lastSeen === undefined) return false;
    return now - lastSeen < dedupeWindow;
  }

  function canHandle(fingerprint: string): boolean {
    return !isDuplicate(fingerprint, Date.now());
  }

  function enqueue(
    slot: InternalSlot,
  ): "active" | "queued" | "deduped" | "dropped" {
    const now = Date.now();
    if (isDuplicate(slot.fingerprint, now)) {
      onDropped?.(slot.error, "dedupe");
      return "deduped";
    }

    dedupeMap.set(slot.fingerprint, now);
    const prevTimer = dedupeTimers.get(slot.fingerprint);
    if (prevTimer !== undefined) clearTimeout(prevTimer);
    dedupeTimers.set(
      slot.fingerprint,
      setTimeout(() => {
        dedupeMap.delete(slot.fingerprint);
        dedupeTimers.delete(slot.fingerprint);
      }, dedupeWindow),
    );

    if (activeSlots.size < maxConcurrent) {
      activateSlot(slot, slot._pendingAction as UIAction);
      return "active";
    }

    if (maxQueue !== undefined && queue.length >= maxQueue) {
      onDropped?.(slot.error, "queue_overflow");
      return "dropped";
    }

    slot.state = "QUEUED";
    queue.push(slot);
    return "queued";
  }

  function release(code: TCode): void {
    // Collect all matching fingerprints first (avoid mutating Map during iteration)
    const toRelease: string[] = [];
    for (const [fp, slot] of activeSlots) {
      if (slot.error.code === code) toRelease.push(fp);
    }

    for (const fp of toRelease) {
      const slot = activeSlots.get(fp)!;
      slot.state = "EXPIRED";
      activeSlots.delete(fp);
      const timer = ttlTimers.get(fp);
      if (timer !== undefined) {
        clearTimeout(timer);
        ttlTimers.delete(fp);
      }
      notify({ type: "ERROR_CLEARED", code });
      promoteFromQueue();
    }

    if (toRelease.length > 0) return;

    // Check queue — spec: QUEUED | clear() → EXPIRED | remove from queue
    const queueIdx = queue.findIndex((slot) => slot.error.code === code);
    if (queueIdx !== -1) {
      const slot = queue[queueIdx];
      slot.state = "EXPIRED";
      queue.splice(queueIdx, 1);
      notify({ type: "ERROR_CLEARED", code });
    }
  }

  function getActiveSlots(): ErrorSlot<TCode>[] {
    return Array.from(activeSlots.values());
  }

  function getActiveCount(): number {
    return activeSlots.size;
  }

  function getQueueLength(): number {
    return queue.length;
  }

  function clearAll(): void {
    for (const timer of ttlTimers.values()) clearTimeout(timer);
    ttlTimers.clear();
    for (const timer of dedupeTimers.values()) clearTimeout(timer);
    dedupeTimers.clear();
    dedupeMap.clear();
    activeSlots.clear();
    queue.length = 0;
    notify({ type: "ALL_CLEARED" });
  }

  function subscribe(listener: StateListener<TCode>): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function destroy(): void {
    for (const timer of ttlTimers.values()) clearTimeout(timer);
    ttlTimers.clear();
    for (const timer of dedupeTimers.values()) clearTimeout(timer);
    dedupeTimers.clear();
    dedupeMap.clear();
    activeSlots.clear();
    queue.length = 0;
    listeners.clear();
  }

  return {
    canHandle,
    enqueue,
    release,
    getActiveSlots,
    getActiveCount,
    getQueueLength,
    clearAll,
    subscribe,
    destroy,
  };
}

export type { ErrorStateManager, StateListener } from "./types";
