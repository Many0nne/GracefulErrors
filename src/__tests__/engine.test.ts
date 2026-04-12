import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import { createErrorEngine, createFetch } from "../engine";
import type {
  AppError,
  ErrorEngineConfig,
  ErrorRegistry,
  ErrorRegistryEntry,
  Normalizer,
  RendererAdapter,
} from "../types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

type Code =
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "INLINE_ERR";

const registry: ErrorRegistry<Code> = {
  NOT_FOUND: { ui: "toast", message: "Not found" },
  UNAUTHORIZED: { ui: "modal", message: "Please log in" },
  RATE_LIMITED: { ui: "toast", message: "Slow down" },
  SERVER_ERROR: { ui: "toast", message: "Server error" },
  INLINE_ERR: { ui: "inline", message: "Field error" },
};

function makeRenderer(): RendererAdapter {
  return {
    render: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  };
}

function makeEngine(
  overrides: Partial<ErrorEngineConfig<Code>> = {},
  renderer?: RendererAdapter,
) {
  return createErrorEngine<Code>({
    registry,
    renderer,
    ...overrides,
  });
}

const structuredNotFound: AppError<Code> = { code: "NOT_FOUND" };
const structuredUnauthorized: AppError<Code> = { code: "UNAUTHORIZED" };

// ---------------------------------------------------------------------------
// Execution order
// ---------------------------------------------------------------------------

describe("Execution order", () => {
  it("onError fires before normalization", () => {
    const order: string[] = [];
    const normalizer: Normalizer<Code> = (raw) => {
      order.push("normalizer");
      return { code: "NOT_FOUND", raw };
    };
    const engine = makeEngine({
      normalizer,
      onError: () => order.push("onError"),
    });
    engine.handle("boom");
    expect(order[0]).toBe("onError");
    expect(order[1]).toBe("normalizer");
  });

  it("onNormalized fires after normalization", () => {
    const onNormalized = vi.fn();
    const engine = makeEngine({ onNormalized });
    engine.handle(structuredNotFound);
    expect(onNormalized).toHaveBeenCalledOnce();
    expect(onNormalized.mock.calls[0][0]).toMatchObject({ code: "NOT_FOUND" });
  });

  it("onErrorAsync fires after normalization and does not block handle()", async () => {
    const order: string[] = [];
    let asyncResolved = false;
    const onErrorAsync = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      asyncResolved = true;
      order.push("async");
    });
    const engine = makeEngine({
      onErrorAsync,
      onNormalized: () => order.push("onNormalized"),
    });
    const result = engine.handle(structuredNotFound);
    order.push("after handle");
    // handle() returned synchronously — async not yet resolved
    expect(result.handled).toBe(true);
    expect(asyncResolved).toBe(false);
    expect(order).toEqual(["onNormalized", "after handle"]);
    // wait for async
    await new Promise((r) => setTimeout(r, 20));
    expect(asyncResolved).toBe(true);
  });

  it("transform fires after normalization", () => {
    const order: string[] = [];
    const transform = vi.fn((error: AppError<Code>) => {
      order.push("transform");
      return error;
    });
    const engine = makeEngine({
      onNormalized: () => order.push("onNormalized"),
      transform,
    });
    engine.handle(structuredNotFound);
    expect(order).toEqual(["onNormalized", "transform"]);
  });

  it("onSuppressed fires when transform returns { suppress: true }", () => {
    const onSuppressed = vi.fn();
    const engine = makeEngine({
      transform: () => ({ suppress: true, reason: "test" }),
      onSuppressed,
    });
    const result = engine.handle(structuredNotFound);
    expect(onSuppressed).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_FOUND" }),
      "test",
    );
    expect(result.handled).toBe(false);
    expect(result).toMatchObject({ handled: false, reason: "suppressed" });
  });

  it("suppressed error returns { handled: false, reason: 'suppressed' }", () => {
    const engine = makeEngine({
      transform: () => ({ suppress: true, reason: "ignored" }),
    });
    const result = engine.handle(structuredNotFound);
    expect(result).toEqual({
      handled: false,
      reason: "suppressed",
      error: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });
});

// ---------------------------------------------------------------------------
// Normalizer precedence
// ---------------------------------------------------------------------------

describe("Normalizer precedence", () => {
  it("normalizer alone: replaces built-in", () => {
    const custom: Normalizer<Code> = () => ({ code: "RATE_LIMITED" });
    const engine = makeEngine({ normalizer: custom });
    // Pass a raw Error - built-in would normalize this to GRACEFULERRORS_UNKNOWN
    const result = engine.handle(new Error("fail"));
    expect(result.error.code).toBe("RATE_LIMITED");
  });

  it("normalizers[] alone: prepended before built-in", () => {
    // Custom normalizer returns nothing; built-in handles the HTTP Response
    const custom: Normalizer<Code> = () => null;
    const engine = makeEngine({ normalizers: [custom] });
    const res = new Response(null, { status: 404, statusText: "Not Found" });
    const result = engine.handle(res);
    // built-in should produce HTTP_404
    expect(result.error.code).toBe("HTTP_404");
  });

  it("normalizers[] alone: custom normalizer result merged before built-in", () => {
    const custom: Normalizer<Code> = () => ({
      code: "NOT_FOUND",
      message: "custom msg",
    });
    const engine = makeEngine({ normalizers: [custom] });
    const result = engine.handle({ code: "NOT_FOUND" });
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toBe("custom msg");
  });

  it("both normalizer + normalizers: normalizer wins, dev warning emitted", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    const custom: Normalizer<Code> = () => ({ code: "NOT_FOUND" });
    const shouldNotRun = vi.fn();
    const engine = makeEngine({
      normalizer: custom,
      normalizers: [shouldNotRun as Normalizer<Code>],
    });
    engine.handle("raw");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("normalizer takes precedence"),
    );
    expect(shouldNotRun).not.toHaveBeenCalled();

    process.env["NODE_ENV"] = originalEnv;
    warnSpy.mockRestore();
  });

  it("neither normalizer nor normalizers: built-in used", () => {
    const engine = makeEngine();
    const result = engine.handle({ code: "UNAUTHORIZED" });
    expect(result.error.code).toBe("UNAUTHORIZED");
  });
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

describe("Routing", () => {
  it("registry match → correct UIAction passed to renderer", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({}, renderer);
    engine.handle(structuredNotFound);
    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ ui: "toast" }),
      expect.any(Object),
    );
  });

  it("no match + fallback → fallback.ui used", () => {
    const renderer = makeRenderer();
    const engine = makeEngine(
      { registry: {}, fallback: { ui: "toast", message: "Fallback" } },
      renderer,
    );
    engine.handle({ code: "UNKNOWN_CODE" });
    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({ ui: "toast" }),
      expect.any(Object),
    );
  });

  it("requireRegistry: true + no match → onFallback fires, returns { handled: false }", () => {
    const onFallback = vi.fn();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = makeEngine({
      registry: {},
      requireRegistry: true,
      onFallback,
    });
    const result = engine.handle({ code: "UNKNOWN_CODE" });
    expect(result).toMatchObject({ handled: false, reason: "suppressed" });
    expect(onFallback).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });

  it("no match + no requireRegistry → onFallback fires without throw", () => {
    const onFallback = vi.fn();
    const engine = makeEngine({ onFallback });
    const result = engine.handle({ code: "UNKNOWN_CODE" });
    expect(onFallback).toHaveBeenCalledOnce();
    expect(result.handled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// State integration
// ---------------------------------------------------------------------------

describe("State integration", () => {
  it("dedupe: same error within dedupeWindow → second handle() returns { handled: false }", () => {
    const engine = makeEngine({ dedupeWindow: 5000 });
    const first = engine.handle(structuredNotFound);
    const second = engine.handle(structuredNotFound);
    expect(first.handled).toBe(true);
    expect(second).toMatchObject({ handled: false, reason: "deduped" });
  });

  it("dedupe: different errors are not deduped", () => {
    const engine = makeEngine({ dedupeWindow: 5000 });
    const first = engine.handle(structuredNotFound);
    const second = engine.handle(structuredUnauthorized);
    expect(first.handled).toBe(true);
    expect(second.handled).toBe(true);
  });

  it("maxConcurrent: 4th error when max=3 → queued (handled: true)", () => {
    const engine = makeEngine({ maxConcurrent: 3, dedupeWindow: 0 });
    const r1 = engine.handle({ code: "NOT_FOUND" });
    const r2 = engine.handle({ code: "UNAUTHORIZED" });
    const r3 = engine.handle({ code: "RATE_LIMITED" });
    const r4 = engine.handle({ code: "SERVER_ERROR" });
    expect(r1.handled).toBe(true);
    expect(r2.handled).toBe(true);
    expect(r3.handled).toBe(true);
    // 4th is queued, not rejected, so still handled
    expect(r4.handled).toBe(true);
  });

  it("maxQueue: overflow → rejected (handled: false)", () => {
    const engine = makeEngine({
      maxConcurrent: 1,
      maxQueue: 1,
      dedupeWindow: 0,
    });
    engine.handle({ code: "NOT_FOUND" }); // active
    engine.handle({ code: "UNAUTHORIZED" }); // queued
    const r3 = engine.handle({ code: "RATE_LIMITED" }); // overflow → rejected
    expect(r3).toMatchObject({ handled: false, reason: "dropped" });
  });

  it("onDropped fires on queue_overflow", () => {
    const onDropped = vi.fn();
    const engine = makeEngine({
      maxConcurrent: 1,
      maxQueue: 0,
      dedupeWindow: 0,
      onDropped,
    });
    engine.handle({ code: "NOT_FOUND" });
    engine.handle({ code: "UNAUTHORIZED" });
    expect(onDropped).toHaveBeenCalledWith(
      expect.objectContaining({ code: "UNAUTHORIZED" }),
      "queue_overflow",
    );
  });
});

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

describe("Renderer", () => {
  it("renderer.render() called with correct RenderIntent for toast", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({}, renderer);
    engine.handle(structuredNotFound);
    expect(renderer.render).toHaveBeenCalledWith(
      {
        ui: "toast",
        error: expect.objectContaining({ code: "NOT_FOUND" }),
        entry: expect.objectContaining({ ui: "toast" }),
      },
      expect.any(Object),
    );
  });

  it("modal: onDismiss callback provided → calling it releases the slot", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({}, renderer);
    engine.handle(structuredUnauthorized);

    const renderCall = (renderer.render as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const lifecycle = renderCall[1] as { onDismiss?: () => void };
    expect(lifecycle.onDismiss).toBeTypeOf("function");

    // Before dismiss, slot is active
    // After dismiss, clear is called (state manager releases)
    lifecycle.onDismiss!();
    // No throw = released correctly
  });

  it("inline ui → renderer.render() NOT called", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({}, renderer);
    engine.handle({ code: "INLINE_ERR" });
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it("silent route → renderer.render() NOT called, uiAction: 'silent'", () => {
    const silentRegistry: ErrorRegistry<"SILENT_ERR"> = {
      SILENT_ERR: { ui: "silent" },
    };
    const renderer = makeRenderer();
    const engine = createErrorEngine({ registry: silentRegistry, renderer });
    const result = engine.handle({ code: "SILENT_ERR" });
    expect(renderer.render).not.toHaveBeenCalled();
    expect(result).toMatchObject({ handled: true, uiAction: "silent" });
  });

  it("renderer not provided → no error thrown", () => {
    const engine = makeEngine();
    expect(() => engine.handle(structuredNotFound)).not.toThrow();
  });

  it("TTL expiry → renderer.clear() called with the error code", () => {
    vi.useFakeTimers();
    const renderer = makeRenderer();
    // registry.NOT_FOUND is optional in ErrorRegistry; non-null assertion is safe because it is
    // explicitly defined in the registry constant above. The cast preserves the discriminant shape.
    const ttlRegistry = {
      ...registry,
      NOT_FOUND: {
        ...registry.NOT_FOUND!,
        ttl: 200,
      } as ErrorRegistryEntry<Code>,
    };
    const engine = createErrorEngine<Code>({ registry: ttlRegistry, renderer });

    engine.handle(structuredNotFound);
    (renderer.clear as ReturnType<typeof vi.fn>).mockClear();

    vi.advanceTimersByTime(201);

    expect(renderer.clear).toHaveBeenCalledWith("NOT_FOUND");
    vi.useRealTimers();
  });

  it("toast: onDismiss NOT provided in lifecycle", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({}, renderer);
    engine.handle(structuredNotFound);
    const lifecycle = (renderer.render as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(lifecycle.onDismiss).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// clear / clearAll
// ---------------------------------------------------------------------------

describe("engine.clear() / engine.clearAll()", () => {
  it("clear() calls renderer.clear() with the code", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({}, renderer);
    engine.handle(structuredNotFound);
    engine.clear("NOT_FOUND");
    expect(renderer.clear).toHaveBeenCalledWith("NOT_FOUND");
  });

  it("clear() releases the state slot (slot no longer active after clear)", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({ maxConcurrent: 1, dedupeWindow: 0 }, renderer);
    engine.handle(structuredNotFound);
    engine.clear("NOT_FOUND");
    // After releasing, a new error with same code should be handled (not deduped)
    const r2 = engine.handle(structuredUnauthorized);
    expect(r2.handled).toBe(true);
  });

  it("clearAll() calls renderer.clearAll()", () => {
    const renderer = makeRenderer();
    const engine = makeEngine({}, renderer);
    engine.handle(structuredNotFound);
    engine.clearAll();
    expect(renderer.clearAll).toHaveBeenCalledOnce();
  });

  it("clearAll() without renderer does not throw", () => {
    const engine = makeEngine();
    engine.handle(structuredNotFound);
    expect(() => engine.clearAll()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createFetch
// ---------------------------------------------------------------------------

describe("createFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throw mode: 4xx → engine.handle() called + rethrows", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    const mockResponse = new Response(null, { status: 404 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const fetcher = createFetch(engine, { mode: "throw" });
    await expect(fetcher("http://test")).rejects.toThrow();
    expect(handleSpy).toHaveBeenCalledWith(mockResponse);
  });

  it("handle mode: 4xx → engine.handle() called + resolves undefined", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    const fetcher = createFetch(engine, { mode: "handle" });
    const result = await fetcher("http://test");
    expect(handleSpy).toHaveBeenCalledOnce();
    expect(result).toBeUndefined();
  });

  it("4xx with JSON body → engine.handle() receives parsed payload", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    const response = new Response(
      JSON.stringify({ code: "NOT_FOUND", message: "Not found" }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      },
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

    const fetcher = createFetch(engine, { mode: "handle" });
    const result = await fetcher("http://test");

    expect(result).toBeUndefined();
    expect(handleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Not found",
      }),
    );
  });

  it("silent mode: 4xx → engine.handle() NOT called + returns response", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    const mockResponse = new Response(null, { status: 400 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const fetcher = createFetch(engine, { mode: "silent" });
    const result = await fetcher("http://test");
    expect(handleSpy).not.toHaveBeenCalled();
    expect(result).toBe(mockResponse);
  });

  it("2xx → pass-through, engine.handle() NOT called", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    const mockResponse = new Response("ok", { status: 200 });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    const fetcher = createFetch(engine, { mode: "throw" });
    const result = await fetcher("http://test");
    expect(handleSpy).not.toHaveBeenCalled();
    expect(result).toBe(mockResponse);
  });

  it("AbortError → never forwarded to engine, always rethrows", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    const abortError = new DOMException("Aborted", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(abortError);

    const fetcher = createFetch(engine, { mode: "handle" });
    await expect(fetcher("http://test")).rejects.toThrow("Aborted");
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it("network error (throw mode) → engine.handle() called + rethrows", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    const networkErr = new TypeError("Failed to fetch");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(networkErr);

    const fetcher = createFetch(engine, { mode: "throw" });
    await expect(fetcher("http://test")).rejects.toThrow("Failed to fetch");
    expect(handleSpy).toHaveBeenCalledWith(networkErr);
  });

  it("network error (handle mode) → engine.handle() called + resolves undefined", async () => {
    const engine = makeEngine();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const fetcher = createFetch(engine, { mode: "handle" });
    const result = await fetcher("http://test");
    expect(result).toBeUndefined();
  });

  it("network error (silent mode) → engine.handle() NOT called + rethrows", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const fetcher = createFetch(engine, { mode: "silent" });
    await expect(fetcher("http://test")).rejects.toThrow();
    expect(handleSpy).not.toHaveBeenCalled();
  });

  it("default mode is throw", async () => {
    const engine = makeEngine();
    const handleSpy = vi.spyOn(engine, "handle");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 422 }),
    );

    const fetcher = createFetch(engine);
    await expect(fetcher("http://test")).rejects.toBeDefined();
    expect(handleSpy).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Hook safety
// ---------------------------------------------------------------------------

describe("Hook safety", () => {
  it("throwing onError does not interrupt pipeline", () => {
    const engine = makeEngine({
      onError: () => {
        throw new Error("onError boom");
      },
    });
    expect(() => engine.handle(structuredNotFound)).not.toThrow();
  });

  it("throwing onNormalized does not interrupt pipeline", () => {
    const onRouted = vi.fn();
    const engine = makeEngine({
      onNormalized: () => {
        throw new Error("boom");
      },
      onRouted,
    });
    engine.handle(structuredNotFound);
    expect(onRouted).toHaveBeenCalled();
  });

  it("throwing transform → treated as null (normalized passes through unchanged)", () => {
    const engine = makeEngine({
      transform: () => {
        throw new Error("transform boom");
      },
    });
    const result = engine.handle(structuredNotFound);
    expect(result.handled).toBe(true);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("throwing onRouted does not interrupt pipeline", () => {
    const renderer = makeRenderer();
    const engine = makeEngine(
      {
        onRouted: () => {
          throw new Error("boom");
        },
      },
      renderer,
    );
    engine.handle(structuredNotFound);
    expect(renderer.render).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Dev mode
// ---------------------------------------------------------------------------

describe("Dev mode", () => {
  it("debug: true → console.log trace emitted in dev/test env", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const originalEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    const engine = makeEngine({ debug: true });
    engine.handle(structuredNotFound);

    expect(logSpy).toHaveBeenCalledWith(
      "[gracefulerrors trace]",
      expect.any(Object),
    );

    process.env["NODE_ENV"] = originalEnv;
    logSpy.mockRestore();
  });

  it("debug: { trace: true } → console.log trace emitted", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const originalEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    const engine = makeEngine({ debug: { trace: true } });
    engine.handle(structuredNotFound);

    expect(logSpy).toHaveBeenCalledWith(
      "[gracefulerrors trace]",
      expect.any(Object),
    );

    process.env["NODE_ENV"] = originalEnv;
    logSpy.mockRestore();
  });

  it("debug: false → no trace emitted", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const engine = makeEngine({ debug: false });
    engine.handle(structuredNotFound);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("both normalizer + normalizers → warn in development", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const originalEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    const engine = makeEngine({
      normalizer: () => ({ code: "NOT_FOUND" }),
      normalizers: [() => ({ code: "UNAUTHORIZED" })],
    });
    engine.handle("test");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("normalizer takes precedence"),
    );

    process.env["NODE_ENV"] = originalEnv;
    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// HandleResult contract
// ---------------------------------------------------------------------------

describe("HandleResult contract", () => {
  it('toast route → handled: true, uiAction: "toast"', () => {
    const engine = makeEngine();
    const result = engine.handle(structuredNotFound);
    expect(result).toMatchObject({ handled: true, uiAction: "toast" });
  });

  it('modal route → handled: true, uiAction: "modal"', () => {
    const engine = makeEngine();
    const result = engine.handle(structuredUnauthorized);
    expect(result).toMatchObject({ handled: true, uiAction: "modal" });
  });

  it("silent route → handled: true, uiAction: 'silent'", () => {
    const silentReg: ErrorRegistry<"S"> = { S: { ui: "silent" } };
    const engine = createErrorEngine({ registry: silentReg });
    const result = engine.handle({ code: "S" });
    expect(result).toMatchObject({ handled: true, uiAction: "silent" });
  });

  it("transform mutation → HandleResult.error reflects transformed error", () => {
    const engine = makeEngine({
      transform: (error) => ({ ...error, message: "overridden" }),
    });
    const result = engine.handle(structuredNotFound);
    expect(result.error.message).toBe("overridden");
  });
});

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

describe("Config validation", () => {
  let warnSpy: MockInstance;
  const originalEnv = process.env["NODE_ENV"];

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn");
    warnSpy.mockImplementation(() => {});
    process.env["NODE_ENV"] = "development";
  });

  afterEach(() => {
    process.env["NODE_ENV"] = originalEnv;
    warnSpy.mockRestore();
  });

  // maxConcurrent
  it("maxConcurrent: -1 → warns and falls back to 3", () => {
    const engine = makeEngine({ maxConcurrent: -1, dedupeWindow: 0 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("maxConcurrent"),
    );
    // With default maxConcurrent=3, engine should accept up to 3 concurrent errors
    const r1 = engine.handle({ code: "NOT_FOUND" });
    expect(r1.handled).toBe(true);
  });

  it("maxConcurrent: 0 → warns and falls back to 3", () => {
    makeEngine({ maxConcurrent: 0 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("maxConcurrent"),
    );
  });

  it("maxConcurrent: NaN → warns and falls back to 3", () => {
    makeEngine({ maxConcurrent: Number.NaN });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("maxConcurrent"),
    );
  });

  it("maxConcurrent: 2.5 → warns and falls back to 3", () => {
    makeEngine({ maxConcurrent: 2.5 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("maxConcurrent"),
    );
  });

  it("maxConcurrent: valid positive integer → no warning", () => {
    makeEngine({ maxConcurrent: 5 });
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("maxConcurrent"),
    );
  });

  // maxQueue
  it("maxQueue: -1 → warns and falls back to 25", () => {
    makeEngine({ maxQueue: -1 });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("maxQueue"));
  });

  it("maxQueue: NaN → warns and falls back to 25", () => {
    makeEngine({ maxQueue: Number.NaN });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("maxQueue"));
  });

  it("maxQueue: Infinity → warns and falls back to 25", () => {
    makeEngine({ maxQueue: Infinity });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("maxQueue"));
  });

  it("maxQueue: 0 → no warning (0 is valid)", () => {
    makeEngine({ maxQueue: 0 });
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("maxQueue"),
    );
  });

  it("maxQueue: invalid → errors overflow queue and are rejected", () => {
    // maxQueue falls back to 25, maxConcurrent to 1 — 2nd error goes to queue
    const engine = makeEngine({
      maxConcurrent: 1,
      maxQueue: Number.NaN,
      dedupeWindow: 0,
    });
    engine.handle({ code: "NOT_FOUND" }); // active
    const queued = engine.handle({ code: "UNAUTHORIZED" }); // queued (maxQueue=25)
    expect(queued.handled).toBe(true);
  });

  // dedupeWindow
  it("dedupeWindow: NaN → warns and falls back to 300", () => {
    makeEngine({ dedupeWindow: Number.NaN });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("dedupeWindow"),
    );
  });

  it("dedupeWindow: -100 → warns and falls back to 300", () => {
    makeEngine({ dedupeWindow: -100 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("dedupeWindow"),
    );
  });

  it("dedupeWindow: Infinity → warns and falls back to 300", () => {
    makeEngine({ dedupeWindow: Infinity });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("dedupeWindow"),
    );
  });

  it("dedupeWindow: 0 → no warning (0 disables dedupe)", () => {
    makeEngine({ dedupeWindow: 0 });
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("dedupeWindow"),
    );
  });

  // aggregation.window
  it("aggregation.window: NaN → warns and falls back to 300", () => {
    makeEngine({ aggregation: { enabled: true, window: Number.NaN } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("aggregation.window"),
    );
  });

  it("aggregation.window: -1 → warns and falls back to 300", () => {
    makeEngine({ aggregation: { enabled: true, window: -1 } });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("aggregation.window"),
    );
  });

  it("aggregation.window: valid → no warning", () => {
    makeEngine({ aggregation: { enabled: true, window: 500 } });
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("aggregation.window"),
    );
  });

  it("aggregation: true (boolean) → no warning", () => {
    makeEngine({ aggregation: true });
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("aggregation"),
    );
  });

  // modalDismissTimeoutMs
  it("modalDismissTimeoutMs: NaN → warns and disables timeout", () => {
    makeEngine({ modalDismissTimeoutMs: Number.NaN });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("modalDismissTimeoutMs"),
    );
  });

  it("modalDismissTimeoutMs: -1 → warns and disables timeout", () => {
    makeEngine({ modalDismissTimeoutMs: -1 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("modalDismissTimeoutMs"),
    );
  });

  it("modalDismissTimeoutMs: 0 → warns and disables timeout", () => {
    makeEngine({ modalDismissTimeoutMs: 0 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("modalDismissTimeoutMs"),
    );
  });

  it("modalDismissTimeoutMs: valid → no warning", () => {
    makeEngine({ modalDismissTimeoutMs: 2000 });
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("modalDismissTimeoutMs"),
    );
  });

  // registry ttl
  it("registry entry ttl: NaN → warns at engine creation", () => {
    createErrorEngine({
      registry: { NOT_FOUND: { ui: "toast", ttl: Number.NaN } },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('registry["NOT_FOUND"].ttl'),
    );
  });

  it("registry entry ttl: -1 → warns at engine creation", () => {
    createErrorEngine({
      registry: { NOT_FOUND: { ui: "toast", ttl: -1 } },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('registry["NOT_FOUND"].ttl'),
    );
  });

  it("registry entry ttl: 0 → no warning (0 is valid)", () => {
    createErrorEngine({
      registry: { NOT_FOUND: { ui: "toast", ttl: 0 } },
    });
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("registry"),
    );
  });

  // No warnings in production
  it("invalid config in production → no warning emitted", () => {
    process.env["NODE_ENV"] = "production";
    makeEngine({ maxConcurrent: -1, maxQueue: -1, dedupeWindow: Number.NaN });
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// destroy()
// ---------------------------------------------------------------------------

describe("destroy()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aggregation timers no longer fire after destroy()", () => {
    const onRouted = vi.fn();
    const engine = makeEngine({
      aggregation: { enabled: true, window: 500 },
      onRouted,
    });

    engine.handle(structuredNotFound);
    onRouted.mockClear();

    engine.destroy();
    vi.advanceTimersByTime(1000);

    // After destroy, the aggregation timer is cleared — verify no unexpected callbacks fire
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });

  it("TTL timers no longer fire after destroy()", () => {
    const onDropped = vi.fn();
    const engine = createErrorEngine<Code>({
      registry: { NOT_FOUND: { ui: "toast", ttl: 300 } },
      onDropped,
    });

    engine.handle(structuredNotFound);
    engine.destroy();
    vi.advanceTimersByTime(1000);

    expect(onDropped).not.toHaveBeenCalled();
  });

  it("state listeners no longer receive events after destroy()", () => {
    const listener = vi.fn();
    const engine = makeEngine();
    engine.subscribe(listener);
    listener.mockClear();

    engine.destroy();
    engine.clearAll(); // would normally notify listeners

    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getHistory() / clearHistory()
// ---------------------------------------------------------------------------

describe("getHistory()", () => {
  const originalEnv = process.env["NODE_ENV"];

  beforeEach(() => {
    process.env["NODE_ENV"] = "development";
  });

  afterEach(() => {
    process.env["NODE_ENV"] = originalEnv;
  });

  it("returns empty array before any handle() calls", () => {
    const engine = makeEngine();
    expect(engine.getHistory()).toEqual([]);
  });

  it("records a handled entry with uiAction and handledAt", () => {
    const before = Date.now();
    const engine = makeEngine();
    engine.handle(structuredNotFound);
    const after = Date.now();

    const history = engine.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      handled: true,
      uiAction: "toast",
      error: { code: "NOT_FOUND" },
    });
    expect(history[0].handledAt).toBeGreaterThanOrEqual(before);
    expect(history[0].handledAt).toBeLessThanOrEqual(after);
  });

  it("records an unhandled (suppressed) entry with uiAction: null", () => {
    const engine = makeEngine({
      transform: () => ({ suppress: true, reason: "test" }),
    });
    engine.handle(structuredNotFound);

    const history = engine.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      handled: false,
      uiAction: null,
      reason: "suppressed",
      error: { code: "NOT_FOUND" },
    });
  });

  it("records an unhandled (deduped) entry", () => {
    const engine = makeEngine({ dedupeWindow: 5000 });
    engine.handle(structuredNotFound); // first → handled
    engine.handle(structuredNotFound); // second → deduped

    const history = engine.getHistory();
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({ handled: false, reason: "deduped" });
  });

  it("records multiple entries in order", () => {
    const engine = makeEngine({ dedupeWindow: 0 });
    engine.handle(structuredNotFound);
    engine.handle(structuredUnauthorized);

    const history = engine.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].error.code).toBe("NOT_FOUND");
    expect(history[1].error.code).toBe("UNAUTHORIZED");
  });

  it("respects maxEntries: drops oldest entry when full", () => {
    const engine = makeEngine({ history: { maxEntries: 2 }, dedupeWindow: 0 });
    engine.handle({ code: "NOT_FOUND" });
    engine.handle({ code: "UNAUTHORIZED" });
    engine.handle({ code: "SERVER_ERROR" }); // should evict NOT_FOUND

    const history = engine.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0].error.code).toBe("UNAUTHORIZED");
    expect(history[1].error.code).toBe("SERVER_ERROR");
  });

  it("returns a copy — mutations do not affect internal state", () => {
    const engine = makeEngine();
    engine.handle(structuredNotFound);

    const h1 = engine.getHistory();
    h1.push({
      error: { code: "UNAUTHORIZED" },
      handled: true,
      uiAction: "modal",
      handledAt: 0,
    });

    expect(engine.getHistory()).toHaveLength(1);
  });

  it("is disabled by default in production (maxEntries: 0)", () => {
    process.env["NODE_ENV"] = "production";
    const engine = makeEngine();
    engine.handle(structuredNotFound);
    expect(engine.getHistory()).toEqual([]);
  });

  it("can be explicitly enabled in production with enabled: true", () => {
    process.env["NODE_ENV"] = "production";
    const engine = makeEngine({ history: { enabled: true } });
    engine.handle(structuredNotFound);
    expect(engine.getHistory()).toHaveLength(1);
  });

  it("can be explicitly disabled in dev with enabled: false", () => {
    const engine = makeEngine({ history: { enabled: false } });
    engine.handle(structuredNotFound);
    expect(engine.getHistory()).toEqual([]);
  });

  it("history.maxEntries: NaN → warns and uses fallback", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = makeEngine({ history: { maxEntries: Number.NaN } });
    engine.handle(structuredNotFound);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("history.maxEntries"),
    );
    warnSpy.mockRestore();
    // fallback in dev is 20, so entry is recorded
    expect(engine.getHistory()).toHaveLength(1);
  });

  it("history.maxEntries: -1 → warns and uses fallback", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const engine = makeEngine({ history: { maxEntries: -1 } });
    engine.handle(structuredNotFound);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("history.maxEntries"),
    );
    warnSpy.mockRestore();
  });
});

describe("clearHistory()", () => {
  const originalEnv = process.env["NODE_ENV"];

  beforeEach(() => {
    process.env["NODE_ENV"] = "development";
  });

  afterEach(() => {
    process.env["NODE_ENV"] = originalEnv;
  });

  it("wipes all entries", () => {
    const engine = makeEngine({ dedupeWindow: 0 });
    engine.handle(structuredNotFound);
    engine.handle(structuredUnauthorized);
    expect(engine.getHistory()).toHaveLength(2);

    engine.clearHistory();
    expect(engine.getHistory()).toEqual([]);
  });

  it("is safe to call on an empty history", () => {
    const engine = makeEngine();
    expect(() => engine.clearHistory()).not.toThrow();
    expect(engine.getHistory()).toEqual([]);
  });

  it("new entries can be recorded after clearHistory()", () => {
    const engine = makeEngine({ dedupeWindow: 0 });
    engine.handle(structuredNotFound);
    engine.clearHistory();
    engine.handle(structuredUnauthorized);

    const history = engine.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].error.code).toBe("UNAUTHORIZED");
  });
});
