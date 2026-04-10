import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import {
  ErrorEngineProvider,
  useErrorEngine,
  useFieldError,
  ErrorBoundaryWithEngine,
} from "../react";
import type { ErrorEngine, StateListener } from "../types";

function makeEngine(overrides?: Partial<ErrorEngine>): ErrorEngine {
  return {
    handle: vi.fn().mockReturnValue({
      handled: true,
      error: { code: "ERR" },
      uiAction: "toast",
    }),
    clear: vi.fn(),
    clearAll: vi.fn(),
    subscribe: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// ErrorEngineProvider + useErrorEngine
// ---------------------------------------------------------------------------

describe("ErrorEngineProvider + useErrorEngine", () => {
  it("hook inside provider returns engine", () => {
    const engine = makeEngine();
    let captured: ErrorEngine | null = null;

    function Consumer() {
      captured = useErrorEngine();
      return null;
    }

    render(
      <ErrorEngineProvider engine={engine}>
        <Consumer />
      </ErrorEngineProvider>,
    );

    expect(captured).toBe(engine);
  });

  it("hook outside provider returns null and logs error in dev", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const origEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    let captured: ErrorEngine | null =
      undefined as unknown as ErrorEngine | null;

    function Consumer() {
      captured = useErrorEngine();
      return null;
    }

    render(<Consumer />);

    expect(captured).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[gracefulerrors]"),
    );

    spy.mockRestore();
    process.env["NODE_ENV"] = origEnv;
  });

  it("two nested providers — inner hook returns inner engine", () => {
    const outerEngine = makeEngine();
    const innerEngine = makeEngine();
    let captured: ErrorEngine | null = null;

    function Consumer() {
      captured = useErrorEngine();
      return null;
    }

    render(
      <ErrorEngineProvider engine={outerEngine}>
        <ErrorEngineProvider engine={innerEngine}>
          <Consumer />
        </ErrorEngineProvider>
      </ErrorEngineProvider>,
    );

    expect(captured).toBe(innerEngine);
  });
});

// ---------------------------------------------------------------------------
// useFieldError
// ---------------------------------------------------------------------------

describe("useFieldError", () => {
  let listeners: StateListener[] = [];

  function makeSubscribableEngine(): ErrorEngine {
    listeners = [];
    return makeEngine({
      subscribe: vi.fn((listener: StateListener) => {
        listeners.push(listener);
        return () => {
          listeners = listeners.filter((l) => l !== listener);
        };
      }),
    });
  }

  function emit(event: Parameters<StateListener>[0]) {
    listeners.forEach((l) => l(event));
  }

  function FieldConsumer({ field }: { field: string }) {
    const { error } = useFieldError(field);
    return <div data-testid="error">{error ? error.code : "none"}</div>;
  }

  it("no inline error — returns null", () => {
    const engine = makeSubscribableEngine();
    render(
      <ErrorEngineProvider engine={engine}>
        <FieldConsumer field="email" />
      </ErrorEngineProvider>,
    );
    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("ERROR_ADDED inline with matching field — updates error", async () => {
    const engine = makeSubscribableEngine();
    render(
      <ErrorEngineProvider engine={engine}>
        <FieldConsumer field="email" />
      </ErrorEngineProvider>,
    );

    await act(async () => {
      emit({
        type: "ERROR_ADDED",
        action: "inline",
        error: { code: "EMAIL_INVALID", context: { field: "email" } },
      });
    });

    expect(screen.getByTestId("error").textContent).toBe("EMAIL_INVALID");
  });

  it("ERROR_ADDED inline with different field — error state unchanged", async () => {
    const engine = makeSubscribableEngine();
    render(
      <ErrorEngineProvider engine={engine}>
        <FieldConsumer field="email" />
      </ErrorEngineProvider>,
    );

    await act(async () => {
      emit({
        type: "ERROR_ADDED",
        action: "inline",
        error: { code: "OTHER_ERR", context: { field: "password" } },
      });
    });

    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("ALL_CLEARED — clears error", async () => {
    const engine = makeSubscribableEngine();
    render(
      <ErrorEngineProvider engine={engine}>
        <FieldConsumer field="email" />
      </ErrorEngineProvider>,
    );

    await act(async () => {
      emit({
        type: "ERROR_ADDED",
        action: "inline",
        error: { code: "EMAIL_INVALID", context: { field: "email" } },
      });
    });

    expect(screen.getByTestId("error").textContent).toBe("EMAIL_INVALID");

    await act(async () => {
      emit({ type: "ALL_CLEARED" });
    });

    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("ERROR_CLEARED with matching code — clears error", async () => {
    const engine = makeSubscribableEngine();
    render(
      <ErrorEngineProvider engine={engine}>
        <FieldConsumer field="email" />
      </ErrorEngineProvider>,
    );

    await act(async () => {
      emit({
        type: "ERROR_ADDED",
        action: "inline",
        error: { code: "EMAIL_INVALID", context: { field: "email" } },
      });
    });

    await act(async () => {
      emit({ type: "ERROR_CLEARED", code: "EMAIL_INVALID" });
    });

    expect(screen.getByTestId("error").textContent).toBe("none");
  });

  it("unmount — unsubscribe is called", () => {
    const unsubscribe = vi.fn();
    const engine = makeEngine({
      subscribe: vi.fn().mockReturnValue(unsubscribe),
    });

    const { unmount } = render(
      <ErrorEngineProvider engine={engine}>
        <FieldConsumer field="email" />
      </ErrorEngineProvider>,
    );

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("no provider — returns null without crash", () => {
    render(<FieldConsumer field="email" />);
    expect(screen.getByTestId("error").textContent).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// ErrorBoundaryWithEngine
// ---------------------------------------------------------------------------

describe("ErrorBoundaryWithEngine", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) throw new Error("boom");
    return <div>OK</div>;
  }

  it("renders children when no error", () => {
    render(
      <ErrorBoundaryWithEngine fallback={<div>Error fallback</div>}>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundaryWithEngine>,
    );
    expect(screen.getByText("OK")).toBeTruthy();
  });

  it("when child throws — renders fallback", () => {
    render(
      <ErrorBoundaryWithEngine fallback={<div>Error fallback</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundaryWithEngine>,
    );
    expect(screen.getByText("Error fallback")).toBeTruthy();
  });

  it("componentDidCatch calls engine.handle", () => {
    const engine = makeEngine();
    render(
      <ErrorEngineProvider engine={engine}>
        <ErrorBoundaryWithEngine fallback={<div>fallback</div>}>
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundaryWithEngine>
      </ErrorEngineProvider>,
    );
    expect(engine.handle).toHaveBeenCalledWith(expect.any(Error));
  });

  it("no provider — renders fallback, no engine call, no crash", () => {
    render(
      <ErrorBoundaryWithEngine fallback={<div>fallback</div>}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundaryWithEngine>,
    );
    expect(screen.getByText("fallback")).toBeTruthy();
  });
});
