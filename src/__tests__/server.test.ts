import { describe, it, expect, vi, beforeEach } from "vitest";
import { createServerEngine } from "../server";
import type {
  AppError,
  Normalizer,
  ErrorRegistry,
  ServerErrorEngineConfig,
} from "../types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type Code = "NOT_FOUND" | "UNAUTHORIZED" | "SERVER_ERROR" | "RATE_LIMITED";

const registry: ErrorRegistry<Code> = {
  NOT_FOUND: { ui: "toast", message: "Not found" },
  UNAUTHORIZED: { ui: "modal", message: "Please log in" },
  SERVER_ERROR: { ui: "toast", message: "Server error" },
  RATE_LIMITED: { ui: "toast", message: "Slow down" },
};

function makeEngine(overrides: Partial<ServerErrorEngineConfig<Code>> = {}) {
  return createServerEngine<Code>({ registry, ...overrides });
}

// ---------------------------------------------------------------------------
// SSR-safety: no timers
// ---------------------------------------------------------------------------

describe("SSR safety — no timers", () => {
  it("does not call setTimeout during construction", () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    makeEngine();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not call setTimeout during handle()", () => {
    const engine = makeEngine();
    const spy = vi.spyOn(globalThis, "setTimeout");
    engine.handle({ code: "NOT_FOUND" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("does not call setTimeout when reporters are configured", () => {
    const reporter = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({ reporters: [reporter] });
    const spy = vi.spyOn(globalThis, "setTimeout");
    engine.handle({ code: "NOT_FOUND" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Basic normalization and routing
// ---------------------------------------------------------------------------

describe("handle — normalization and routing", () => {
  it("normalizes a structured error and returns handled:true", () => {
    const engine = makeEngine();
    const result = engine.handle({ code: "NOT_FOUND" });
    expect(result.handled).toBe(true);
    if (result.handled) {
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.uiAction).toBe("toast");
    }
  });

  it("routes UNAUTHORIZED to modal", () => {
    const engine = makeEngine();
    const result = engine.handle({ code: "UNAUTHORIZED" });
    expect(result.handled).toBe(true);
    if (result.handled) expect(result.uiAction).toBe("modal");
  });

  it("uses builtInNormalizer for HTTP Response objects", () => {
    const engine = makeEngine();
    const fakeResponse = { status: 404, ok: false };
    const result = engine.handle(fakeResponse);
    // Built-in normalizer maps 404 → HTTP_404 code
    expect(result.handled).toBe(true);
  });

  it("falls back to toast for unregistered codes without requireRegistry", () => {
    const engine = makeEngine();
    const result = engine.handle({ code: "UNKNOWN_CODE" });
    expect(result.handled).toBe(true);
    if (result.handled) expect(result.uiAction).toBe("toast");
  });

  it("suppresses when requireRegistry is set and code is unregistered", () => {
    const engine = makeEngine({ requireRegistry: true });
    const result = engine.handle({ code: "UNKNOWN_CODE" });
    expect(result.handled).toBe(false);
    if (!result.handled) expect(result.reason).toBe("suppressed");
  });
});

// ---------------------------------------------------------------------------
// Custom normalizer
// ---------------------------------------------------------------------------

describe("handle — custom normalizer", () => {
  it("uses a custom normalizer to map raw errors to known codes", () => {
    const normalizer: Normalizer<Code> = (raw) => {
      if (raw instanceof Error && raw.message === "Not found") {
        return { code: "NOT_FOUND" };
      }
      return null;
    };
    const engine = makeEngine({ normalizer });
    const result = engine.handle(new Error("Not found"));
    expect(result.handled).toBe(true);
    if (result.handled) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("warns (dev only) when both normalizer and normalizers are provided", () => {
    const prev = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const noop: Normalizer<Code> = (_raw, cur) => cur;
    makeEngine({ normalizer: noop, normalizers: [noop] });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("normalizer takes precedence"),
    );
    warnSpy.mockRestore();
    process.env["NODE_ENV"] = prev;
  });
});

// ---------------------------------------------------------------------------
// transform
// ---------------------------------------------------------------------------

describe("handle — transform", () => {
  it("allows remapping the error code", () => {
    const engine = makeEngine({
      transform: (error) => ({ ...error, code: "SERVER_ERROR" as Code }),
    });
    const result = engine.handle({ code: "NOT_FOUND" });
    expect(result.handled).toBe(true);
    if (result.handled) expect(result.error.code).toBe("SERVER_ERROR");
  });

  it("suppresses when transform returns { suppress: true }", () => {
    const engine = makeEngine({
      transform: () => ({ suppress: true, reason: "client-suppressed" }),
    });
    const result = engine.handle({ code: "NOT_FOUND" });
    expect(result.handled).toBe(false);
    if (!result.handled) expect(result.reason).toBe("suppressed");
  });
});

// ---------------------------------------------------------------------------
// routingStrategy
// ---------------------------------------------------------------------------

describe("handle — routingStrategy", () => {
  it("overrides registry routing", () => {
    const engine = makeEngine({
      routingStrategy: () => "silent",
    });
    const result = engine.handle({ code: "NOT_FOUND" });
    expect(result.handled).toBe(true);
    if (result.handled) expect(result.uiAction).toBe("silent");
  });
});

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

describe("handle — lifecycle hooks", () => {
  it("calls onError with the raw value", () => {
    const onError = vi.fn();
    const engine = makeEngine({ onError });
    const raw = new Error("boom");
    engine.handle(raw);
    expect(onError).toHaveBeenCalledWith(raw);
  });

  it("calls onNormalized after normalization", () => {
    const onNormalized = vi.fn();
    const engine = makeEngine({ onNormalized });
    engine.handle({ code: "NOT_FOUND" });
    expect(onNormalized).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND" }),
    );
  });

  it("calls onRouted with the resolved action", () => {
    const onRouted = vi.fn();
    const engine = makeEngine({ onRouted });
    engine.handle({ code: "NOT_FOUND" });
    expect(onRouted).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND" }),
      "toast",
    );
  });

  it("calls onFallback for unregistered codes", () => {
    const onFallback = vi.fn();
    const engine = makeEngine({ onFallback });
    engine.handle({ code: "UNKNOWN_CODE" });
    expect(onFallback).toHaveBeenCalled();
  });

  it("calls onSuppressed when transform suppresses", () => {
    const onSuppressed = vi.fn();
    const engine = makeEngine({
      onSuppressed,
      transform: () => ({ suppress: true, reason: "test-reason" }),
    });
    engine.handle({ code: "NOT_FOUND" });
    expect(onSuppressed).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND" }),
      "test-reason",
    );
  });

  it("calls onErrorAsync without blocking the result", async () => {
    const onErrorAsync = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({ onErrorAsync });
    const result = engine.handle({ code: "NOT_FOUND" });
    // Result is returned synchronously even with async hook
    expect(result.handled).toBe(true);
    await vi.waitFor(() => expect(onErrorAsync).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// Reporters
// ---------------------------------------------------------------------------

describe("handle — reporters", () => {
  it("calls reporter after a successful handle", async () => {
    const reporter = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({ reporters: [reporter] });
    engine.handle({ code: "NOT_FOUND" });
    await vi.waitFor(() => expect(reporter).toHaveBeenCalled());
    const [error, ctx] = reporter.mock.calls[0] as [AppError<Code>, unknown];
    expect(error.code).toBe("NOT_FOUND");
    expect(ctx).toMatchObject({
      result: expect.objectContaining({ handled: true }),
    });
  });

  it("calls multiple reporters independently", async () => {
    const r1 = vi.fn().mockResolvedValue(undefined);
    const r2 = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({ reporters: [r1, r2] });
    engine.handle({ code: "NOT_FOUND" });
    await vi.waitFor(() => {
      expect(r1).toHaveBeenCalled();
      expect(r2).toHaveBeenCalled();
    });
  });

  it("does not call reporters when error is suppressed", async () => {
    const reporter = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({
      reporters: [reporter],
      transform: () => ({ suppress: true, reason: "test" }),
    });
    engine.handle({ code: "NOT_FOUND" });
    await new Promise((r) => setTimeout(r, 10));
    expect(reporter).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("history", () => {
  beforeEach(() => {
    // Ensure dev-mode history is enabled in tests
    process.env["NODE_ENV"] = "test";
  });

  it("records handled errors in history", () => {
    const engine = makeEngine({ history: { enabled: true, maxEntries: 10 } });
    engine.handle({ code: "NOT_FOUND" });
    const hist = engine.getHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0]!.error.code).toBe("NOT_FOUND");
    expect(hist[0]!.handled).toBe(true);
  });

  it("records suppressed errors in history", () => {
    const engine = makeEngine({
      history: { enabled: true },
      transform: () => ({ suppress: true, reason: "test" }),
    });
    engine.handle({ code: "NOT_FOUND" });
    const hist = engine.getHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0]!.handled).toBe(false);
    if (!hist[0]!.handled) expect(hist[0]!.reason).toBe("suppressed");
  });

  it("respects maxEntries limit (FIFO eviction)", () => {
    const engine = makeEngine({ history: { enabled: true, maxEntries: 2 } });
    engine.handle({ code: "NOT_FOUND" });
    engine.handle({ code: "SERVER_ERROR" });
    engine.handle({ code: "UNAUTHORIZED" });
    const hist = engine.getHistory();
    expect(hist).toHaveLength(2);
    expect(hist[0]!.error.code).toBe("SERVER_ERROR");
    expect(hist[1]!.error.code).toBe("UNAUTHORIZED");
  });

  it("clearHistory() empties the history", () => {
    const engine = makeEngine({ history: { enabled: true } });
    engine.handle({ code: "NOT_FOUND" });
    engine.clearHistory();
    expect(engine.getHistory()).toHaveLength(0);
  });

  it("getHistory() returns a snapshot (not a live reference)", () => {
    const engine = makeEngine({ history: { enabled: true } });
    engine.handle({ code: "NOT_FOUND" });
    const snap1 = engine.getHistory();
    engine.handle({ code: "SERVER_ERROR" });
    expect(snap1).toHaveLength(1); // snapshot unchanged
    expect(engine.getHistory()).toHaveLength(2);
  });

  it("disables history when enabled:false", () => {
    const engine = makeEngine({ history: { enabled: false } });
    engine.handle({ code: "NOT_FOUND" });
    expect(engine.getHistory()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Custom fingerprint
// ---------------------------------------------------------------------------

describe("custom fingerprint", () => {
  it("passes the fingerprint to reporters", async () => {
    const reporter = vi.fn().mockResolvedValue(undefined);
    const engine = makeEngine({
      reporters: [reporter],
      fingerprint: (err) => `custom:${err.code}`,
    });
    engine.handle({ code: "NOT_FOUND" });
    await vi.waitFor(() => expect(reporter).toHaveBeenCalled());
    const [, ctx] = reporter.mock.calls[0] as [
      unknown,
      { fingerprint: string },
    ];
    expect(ctx.fingerprint).toBe("custom:NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// fallback config
// ---------------------------------------------------------------------------

describe("fallback", () => {
  it("uses fallback.ui when no registry entry matches", () => {
    const engine = makeEngine({
      fallback: { ui: "silent" },
    });
    const result = engine.handle({ code: "UNKNOWN_CODE" });
    expect(result.handled).toBe(true);
    if (result.handled) expect(result.uiAction).toBe("silent");
  });
});

// ---------------------------------------------------------------------------
// Per-request isolation
// ---------------------------------------------------------------------------

describe("per-request isolation", () => {
  it("two engine instances share no state", () => {
    const engine1 = makeEngine({ history: { enabled: true } });
    const engine2 = makeEngine({ history: { enabled: true } });
    engine1.handle({ code: "NOT_FOUND" });
    expect(engine1.getHistory()).toHaveLength(1);
    expect(engine2.getHistory()).toHaveLength(0);
  });
});
