/**
 * Integration tests: createFetch + createErrorEngine
 *
 * These tests verify that the createFetch wrapper correctly pipes errors from a
 * real (non-mocked) fetch call into a real engine. `global.fetch` is replaced
 * with a vi.spyOn stub so tests remain fast and deterministic while still
 * exercising every layer: fetch wrapper → engine normaliser → router → adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { createErrorEngine, createFetch } from "../../engine";
import { createSonnerAdapter } from "../../adapters/sonner";

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

describe("createFetch + engine — lifecycle hooks", () => {
  it("404 response: onError → onNormalized → onRouted fire in order", async () => {
    const order: string[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: { HTTP_404: { ui: "toast", message: "Not found" } },
      renderer: adapter,
      onError: () => order.push("onError"),
      onNormalized: () => order.push("onNormalized"),
      onRouted: () => order.push("onRouted"),
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" }),
    );

    const fetcher = createFetch(engine, { mode: "handle" });
    await act(async () => {
      await fetcher("http://test.example/api/resource");
    });

    expect(order).toEqual(["onError", "onNormalized", "onRouted"]);
  });

  it("network TypeError: onError → onNormalized → onRouted fire in order", async () => {
    const order: string[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onError: () => order.push("onError"),
      onNormalized: () => order.push("onNormalized"),
      onRouted: () => order.push("onRouted"),
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    const fetcher = createFetch(engine, { mode: "handle" });
    await act(async () => {
      await fetcher("http://unreachable.test/");
    });

    expect(order).toEqual(["onError", "onNormalized", "onRouted"]);
  });
});

// ---------------------------------------------------------------------------
// Error normalisation through the full pipeline
// ---------------------------------------------------------------------------

describe("createFetch + engine — normalisation", () => {
  it("404 response normalises to HTTP_404 code", async () => {
    const normalised: Array<{ code: string; status?: number }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onNormalized: (err) =>
        normalised.push({ code: err.code, status: err.status }),
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await createFetch(engine, { mode: "handle" })(
      "http://test.example/missing",
    );

    expect(normalised[0]).toMatchObject({ code: "HTTP_404", status: 404 });
  });

  it("500 response normalises to HTTP_500 code", async () => {
    const normalised: Array<{ code: string }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onNormalized: (err) => normalised.push({ code: err.code }),
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await createFetch(engine, { mode: "handle" })("http://test.example/crash");

    expect(normalised[0]?.code).toBe("HTTP_500");
  });

  it("JSON error body: code and message are extracted from the response body", async () => {
    const normalised: Array<{ code: string; message?: string }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onNormalized: (err) =>
        normalised.push({ code: err.code, message: err.message }),
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ code: "VALIDATION_ERROR", message: "Invalid input" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );

    await createFetch(engine, { mode: "handle" })("http://test.example/submit");

    expect(normalised[0]).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid input",
    });
  });

  it("network TypeError normalises to NETWORK_ERROR code", async () => {
    const normalised: Array<{ code: string }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onNormalized: (err) => normalised.push({ code: err.code }),
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );

    await createFetch(engine, { mode: "handle" })("http://unreachable.test/");

    expect(normalised[0]?.code).toBe("NETWORK_ERROR");
  });
});

// ---------------------------------------------------------------------------
// Error flows through to the adapter (DOM assertion)
// ---------------------------------------------------------------------------

describe("createFetch + engine — adapter integration", () => {
  it("404 response triggers modal rendering in document.body when routed to modal", async () => {
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {
        HTTP_404: { ui: "modal", message: "Page not found" },
      },
      renderer: adapter,
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await act(async () => {
      await createFetch(engine, { mode: "handle" })(
        "http://test.example/missing",
      );
    });

    expect(document.body.textContent).toContain("Page not found");
  });

  it("AbortError is never forwarded to the engine", async () => {
    const onError = vi.fn();
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {},
      renderer: adapter,
      onError,
    });

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("Aborted", "AbortError"),
    );

    const fetcher = createFetch(engine, { mode: "handle" });
    // AbortError propagates even in handle mode
    await expect(fetcher("http://test.example/aborted")).rejects.toThrow(
      "Aborted",
    );
    expect(onError).not.toHaveBeenCalled();
  });
});
