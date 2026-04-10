/**
 * Integration tests: createAxiosInterceptor + createErrorEngine
 *
 * `axios` is a peer dependency not installed in devDependencies, so a minimal
 * structural double is used instead of a real AxiosInstance. This is
 * intentional — the interceptor depends only on the `interceptors.response`
 * shape (AxiosLike interface), so testing against that shape is sufficient.
 *
 * The real engine (createErrorEngine) is used throughout. These tests confirm
 * that errors flow from the interceptor through the full normalisation →
 * routing → adapter pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { createErrorEngine } from "../../engine";
import { createAxiosInterceptor } from "../../axios";
import { createSonnerAdapter } from "../../adapters/sonner";
import type { AxiosLike } from "../../axios";

// ---------------------------------------------------------------------------
// Minimal Axios-like test double
// ---------------------------------------------------------------------------

function createMinimalAxios(): AxiosLike & {
  _simulateError(error: unknown): Promise<unknown>;
} {
  type OnRejected = (error: unknown) => unknown;
  const interceptors: (OnRejected | null)[] = [];

  return {
    interceptors: {
      response: {
        use(_onFulfilled: null | undefined, onRejected: OnRejected): number {
          interceptors.push(onRejected);
          return interceptors.length - 1;
        },
        eject(id: number): void {
          interceptors[id] = null;
        },
      },
    },
    _simulateError(error: unknown): Promise<unknown> {
      for (const fn of interceptors) {
        if (fn) return Promise.resolve(fn(error));
      }
      return Promise.reject(error);
    },
  };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Lifecycle hooks fire through the full pipeline
// ---------------------------------------------------------------------------

describe("createAxiosInterceptor + engine — lifecycle hooks", () => {
  it("axios error: onError → onNormalized → onRouted fire in order", async () => {
    const order: string[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: { HTTP_401: { ui: "toast", message: "Unauthorised" } },
      renderer: adapter,
      onError: () => order.push("onError"),
      onNormalized: () => order.push("onNormalized"),
      onRouted: () => order.push("onRouted"),
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    await axios._simulateError({
      isAxiosError: true,
      response: { status: 401, data: {} },
      message: "Unauthorized",
    });

    expect(order).toEqual(["onError", "onNormalized", "onRouted"]);
  });

  it("onError receives the original axios error object", async () => {
    const captured: unknown[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onError: (raw) => captured.push(raw),
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    const axiosError = {
      isAxiosError: true,
      response: { status: 500, data: {} },
      message: "Internal Server Error",
    };

    await axios._simulateError(axiosError);

    expect(captured[0]).toBe(axiosError);
  });
});

// ---------------------------------------------------------------------------
// Error normalisation
// ---------------------------------------------------------------------------

describe("createAxiosInterceptor + engine — normalisation", () => {
  it("axios 401 error normalises to HTTP_401 with correct status", async () => {
    const normalised: Array<{ code: string; status?: number }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onNormalized: (err) =>
        normalised.push({ code: err.code, status: err.status }),
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    await axios._simulateError({
      isAxiosError: true,
      response: { status: 401, data: {} },
    });

    expect(normalised[0]).toMatchObject({ code: "HTTP_401", status: 401 });
  });

  it("axios 403 error normalises to HTTP_403", async () => {
    const normalised: Array<{ code: string }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onNormalized: (err) => normalised.push({ code: err.code }),
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    await axios._simulateError({
      isAxiosError: true,
      response: { status: 403, data: {} },
      message: "Forbidden",
    });

    expect(normalised[0]?.code).toBe("HTTP_403");
  });

  it("response.data.code overrides the HTTP status code", async () => {
    const normalised: Array<{ code: string }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: { CUSTOM_ERROR: { ui: "toast", message: "Custom error" } },
      renderer: adapter,
      onNormalized: (err) => normalised.push({ code: err.code }),
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    await axios._simulateError({
      isAxiosError: true,
      response: {
        status: 400,
        data: { code: "CUSTOM_ERROR", message: "Detailed reason" },
      },
    });

    expect(normalised[0]?.code).toBe("CUSTOM_ERROR");
  });

  it("response.data.message is extracted into the normalised error", async () => {
    const normalised: Array<{ message?: string }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onNormalized: (err) => normalised.push({ message: err.message }),
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    await axios._simulateError({
      isAxiosError: true,
      response: {
        status: 422,
        data: { code: "VALIDATION_FAILED", message: "Email is invalid" },
      },
    });

    expect(normalised[0]?.message).toBe("Email is invalid");
  });
});

// ---------------------------------------------------------------------------
// Adapter integration (DOM assertion)
// ---------------------------------------------------------------------------

describe("createAxiosInterceptor + engine — adapter integration", () => {
  it("axios error routed to modal is rendered in document.body", async () => {
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {
        HTTP_401: { ui: "modal", message: "Session expired" },
      },
      renderer: adapter,
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    await act(async () => {
      await axios._simulateError({
        isAxiosError: true,
        response: { status: 401, data: {} },
      });
    });

    expect(document.body.textContent).toContain("Session expired");
  });
});

// ---------------------------------------------------------------------------
// Interceptor modes
// ---------------------------------------------------------------------------

describe("createAxiosInterceptor + engine — modes", () => {
  it("mode: throw — forwards to engine then re-rejects", async () => {
    const onError = vi.fn();
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onError,
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "throw" });

    const axiosError = {
      isAxiosError: true,
      response: { status: 500, data: {} },
    };

    await expect(axios._simulateError(axiosError)).rejects.toBe(axiosError);
    expect(onError).toHaveBeenCalledWith(axiosError);
  });

  it("mode: handle — forwards to engine and resolves undefined", async () => {
    const onError = vi.fn();
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onError,
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "handle" });

    const result = await axios._simulateError({
      isAxiosError: true,
      response: { status: 500, data: {} },
    });

    expect(result).toBeUndefined();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("mode: silent — passes through without notifying the engine", async () => {
    const onError = vi.fn();
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onError,
    });

    const axios = createMinimalAxios();
    createAxiosInterceptor(axios, engine, { mode: "silent" });

    const axiosError = {
      isAxiosError: true,
      response: { status: 403, data: {} },
    };

    await expect(axios._simulateError(axiosError)).rejects.toBe(axiosError);
    expect(onError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unsubscribe
// ---------------------------------------------------------------------------

describe("createAxiosInterceptor + engine — unsubscribe", () => {
  it("eject stops errors from reaching the engine", async () => {
    const onError = vi.fn();
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onError,
    });

    const axios = createMinimalAxios();
    const unsubscribe = createAxiosInterceptor(axios, engine, {
      mode: "handle",
    });

    unsubscribe();

    // After eject the double falls through to its default rejection.
    await axios._simulateError(new Error("ignored")).catch(() => {});

    expect(onError).not.toHaveBeenCalled();
  });
});
