import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStateManager } from "../state-manager";
import type { ErrorSlot, UIAction } from "../types";

function makeSlot(
  code: string,
  fingerprint?: string,
  action: UIAction = "toast",
): ErrorSlot & { _pendingAction: UIAction } {
  return {
    error: { code },
    state: "QUEUED",
    fingerprint: fingerprint ?? code,
    _pendingAction: action,
  };
}

describe("Deduplication", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("same fingerprint within dedupeWindow → second call returns deduped + onDropped(dedupe)", () => {
    const onDropped = vi.fn();
    const sm = createStateManager({ dedupeWindow: 300, onDropped });

    sm.enqueue(makeSlot("FOO"));
    const result = sm.enqueue(makeSlot("FOO"));

    expect(result).toBe("deduped");
    expect(onDropped).toHaveBeenCalledWith({ code: "FOO" }, "dedupe");
  });

  it("same fingerprint after dedupeWindow expires → accepted", () => {
    const sm = createStateManager({ dedupeWindow: 300 });

    sm.enqueue(makeSlot("FOO"));
    vi.advanceTimersByTime(301);
    const result = sm.enqueue(makeSlot("FOO"));

    expect(result).toBe("active");
  });
});

describe("Capacity", () => {
  it("first maxConcurrent errors → all active", () => {
    const sm = createStateManager({ maxConcurrent: 2 });

    expect(sm.enqueue(makeSlot("A", "fp-a"))).toBe("active");
    expect(sm.enqueue(makeSlot("B", "fp-b"))).toBe("active");
  });

  it("next error when at capacity → queued", () => {
    const sm = createStateManager({ maxConcurrent: 2 });

    sm.enqueue(makeSlot("A", "fp-a"));
    sm.enqueue(makeSlot("B", "fp-b"));
    expect(sm.enqueue(makeSlot("C", "fp-c"))).toBe("queued");
  });

  it("maxQueue exceeded → dropped + onDropped(queue_overflow)", () => {
    const onDropped = vi.fn();
    const sm = createStateManager({ maxConcurrent: 1, maxQueue: 1, onDropped });

    sm.enqueue(makeSlot("A", "fp-a"));
    sm.enqueue(makeSlot("B", "fp-b")); // queued
    const result = sm.enqueue(makeSlot("C", "fp-c"));

    expect(result).toBe("dropped");
    expect(onDropped).toHaveBeenCalledWith({ code: "C" }, "queue_overflow");
  });

  it("default maxQueue (25) drops the 26th queued error with onDropped(queue_overflow)", () => {
    const onDropped = vi.fn();
    // maxConcurrent: 1 → slot 0 goes active, slots 1–25 fill the queue (25 items)
    const sm = createStateManager({ maxConcurrent: 1, onDropped });
    sm.enqueue(makeSlot("ACTIVE", "fp-active")); // goes active
    for (let i = 0; i < 25; i++) {
      sm.enqueue(makeSlot(`E${i}`, `fp-${i}`)); // fills queue to default limit
    }
    const result = sm.enqueue(makeSlot("OVERFLOW", "fp-overflow")); // 26th → dropped
    expect(result).toBe("dropped");
    expect(onDropped).toHaveBeenCalledWith(
      expect.objectContaining({ code: "OVERFLOW" }),
      "queue_overflow",
    );
  });
});

describe("Queue promotion", () => {
  it("release(code) when queue is non-empty → queued slot becomes active", () => {
    const sm = createStateManager({ maxConcurrent: 1 });

    sm.enqueue(makeSlot("A", "fp-a"));
    sm.enqueue(makeSlot("B", "fp-b"));
    sm.release("A");

    expect(sm.getActiveSlots().some((s) => s.error.code === "B")).toBe(true);
  });

  it("listener receives ERROR_ADDED for promoted slot", () => {
    const listener = vi.fn();
    const sm = createStateManager({ maxConcurrent: 1 });
    sm.subscribe(listener);

    sm.enqueue(makeSlot("A", "fp-a"));
    sm.enqueue(makeSlot("B", "fp-b"));
    listener.mockClear();

    sm.release("A");

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ERROR_ADDED", error: { code: "B" } }),
    );
  });
});

describe("TTL", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("slot with TTL activates timer only when ACTIVE (not while QUEUED)", () => {
    const onDropped = vi.fn();
    const sm = createStateManager({ maxConcurrent: 1, onDropped });

    sm.enqueue(makeSlot("A", "fp-a"));
    const slotB = { ...makeSlot("B", "fp-b"), ttl: 500 };
    sm.enqueue(slotB); // queued, timer should NOT start

    vi.advanceTimersByTime(600);
    // B is still queued, TTL should not have fired
    expect(onDropped).not.toHaveBeenCalledWith({ code: "B" }, "ttl_expired");
  });

  it("timer fires → slot cleared, onDropped(ttl_expired) called", () => {
    const onDropped = vi.fn();
    const sm = createStateManager({ maxConcurrent: 1, onDropped });

    const slot = { ...makeSlot("A", "fp-a"), ttl: 200 };
    sm.enqueue(slot);

    vi.advanceTimersByTime(201);

    expect(onDropped).toHaveBeenCalledWith({ code: "A" }, "ttl_expired");
    expect(sm.getActiveSlots()).toHaveLength(0);
  });

  it("TTL expiry emits ERROR_CLEARED", () => {
    const listener = vi.fn();
    const sm = createStateManager({ maxConcurrent: 1 });
    sm.subscribe(listener);

    const slot = { ...makeSlot("A", "fp-a"), ttl: 200 };
    sm.enqueue(slot);
    listener.mockClear();

    vi.advanceTimersByTime(201);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ERROR_CLEARED", code: "A" }),
    );
  });

  it("release() before TTL fires → timer cancelled", () => {
    const onDropped = vi.fn();
    const sm = createStateManager({ maxConcurrent: 1, onDropped });

    const slot = { ...makeSlot("A", "fp-a"), ttl: 500 };
    sm.enqueue(slot);
    sm.release("A");

    vi.advanceTimersByTime(600);
    expect(onDropped).not.toHaveBeenCalledWith({ code: "A" }, "ttl_expired");
  });
});

describe("State events", () => {
  it("ERROR_ADDED fires on activation", () => {
    const listener = vi.fn();
    const sm = createStateManager({});
    sm.subscribe(listener);

    sm.enqueue(makeSlot("FOO"));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ERROR_ADDED", error: { code: "FOO" } }),
    );
  });

  it("ERROR_CLEARED fires on release", () => {
    const listener = vi.fn();
    const sm = createStateManager({});
    sm.subscribe(listener);

    sm.enqueue(makeSlot("FOO"));
    listener.mockClear();
    sm.release("FOO");

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "ERROR_CLEARED", code: "FOO" }),
    );
  });

  it("throwing listener does not crash state manager", () => {
    const throwingListener = vi.fn(() => {
      throw new Error("listener boom");
    });
    const sm = createStateManager({});
    sm.subscribe(throwingListener);

    expect(() => sm.enqueue(makeSlot("FOO"))).not.toThrow();
  });
});

describe("release() with multiple fingerprints", () => {
  it("release(code) with distinct fingerprints releases all matching slots", () => {
    const listener = vi.fn();
    const sm = createStateManager({ maxConcurrent: 3 });
    sm.subscribe(listener);

    sm.enqueue(makeSlot("FOO", "fp-1"));
    sm.enqueue(makeSlot("FOO", "fp-2"));
    listener.mockClear();

    sm.release("FOO");

    expect(
      sm.getActiveSlots().filter((s) => s.error.code === "FOO"),
    ).toHaveLength(0);
    const clearedEvents = listener.mock.calls.filter(
      ([e]) => e.type === "ERROR_CLEARED" && e.code === "FOO",
    );
    expect(clearedEvents).toHaveLength(2);
  });
});

describe("getActiveSlots()", () => {
  it("returns snapshot (mutating result does not affect internal state)", () => {
    const sm = createStateManager({});
    sm.enqueue(makeSlot("A", "fp-a"));

    const snapshot = sm.getActiveSlots();
    snapshot.pop();

    expect(sm.getActiveSlots()).toHaveLength(1);
  });
});
