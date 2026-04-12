import { describe, it, expect, vi } from "vitest";
import { createAxiosInterceptor } from "../axios";
import type { ErrorEngine } from "../types";

// Minimal axios-like test double
function createMockAxios() {
  type Interceptor = (error: unknown) => unknown;
  const interceptors: (Interceptor | null)[] = [];

  const instance = {
    interceptors: {
      response: {
        use(_onFulfilled: null | undefined, onRejected: Interceptor): number {
          interceptors.push(onRejected);
          return interceptors.length - 1;
        },
        eject(id: number): void {
          interceptors[id] = null;
        },
      },
    },
    _trigger(error: unknown): unknown {
      for (const fn of interceptors) {
        if (fn) return fn(error);
      }
      return Promise.reject(error);
    },
  };

  return instance;
}

function createMockEngine(): ErrorEngine & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    handle(raw: unknown) {
      calls.push(raw);
      return { handled: true, error: { code: "TEST" }, uiAction: "toast" };
    },
    clear: vi.fn(),
    clearAll: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    destroy: vi.fn(),
    getHistory: vi.fn(() => []),
    clearHistory: vi.fn(),
  };
}

const axiosError = {
  isAxiosError: true,
  response: { status: 401, data: {} },
  message: "Unauthorized",
};

describe("createAxiosInterceptor", () => {
  it("registers an interceptor and returns an unsubscribe function", () => {
    const axios = createMockAxios();
    const engine = createMockEngine();
    const unsub = createAxiosInterceptor(axios, engine);
    expect(typeof unsub).toBe("function");
  });

  describe("mode: throw (default)", () => {
    it("forwards the error to the engine", async () => {
      const axios = createMockAxios();
      const engine = createMockEngine();
      createAxiosInterceptor(axios, engine);

      await expect(axios._trigger(axiosError)).rejects.toBe(axiosError);
      expect(engine.calls).toHaveLength(1);
      expect(engine.calls[0]).toBe(axiosError);
    });

    it("re-throws the original error", async () => {
      const axios = createMockAxios();
      const engine = createMockEngine();
      createAxiosInterceptor(axios, engine, { mode: "throw" });

      await expect(axios._trigger(axiosError)).rejects.toBe(axiosError);
    });
  });

  describe("mode: handle", () => {
    it("forwards to engine and resolves undefined", async () => {
      const axios = createMockAxios();
      const engine = createMockEngine();
      createAxiosInterceptor(axios, engine, { mode: "handle" });

      const result = await axios._trigger(axiosError);
      expect(result).toBeUndefined();
      expect(engine.calls).toHaveLength(1);
    });
  });

  describe("mode: silent", () => {
    it("re-throws without notifying the engine", async () => {
      const axios = createMockAxios();
      const engine = createMockEngine();
      createAxiosInterceptor(axios, engine, { mode: "silent" });

      await expect(axios._trigger(axiosError)).rejects.toBe(axiosError);
      expect(engine.calls).toHaveLength(0);
    });
  });

  describe("unsubscribe", () => {
    it("ejects the interceptor so errors are no longer forwarded", async () => {
      const axios = createMockAxios();
      const engine = createMockEngine();
      const unsub = createAxiosInterceptor(axios, engine);

      unsub();

      // After ejection the mock double falls through to a plain rejection
      await expect(axios._trigger(axiosError)).rejects.toBe(axiosError);
      expect(engine.calls).toHaveLength(0);
    });
  });
});
