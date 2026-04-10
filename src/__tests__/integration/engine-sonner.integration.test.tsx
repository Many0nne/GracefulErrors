/**
 * Integration tests: createErrorEngine + createSonnerAdapter
 *
 * These tests exercise the full pipeline without mocking the adapter or the DOM
 * layer. They validate that:
 *  - lifecycle hooks fire in the documented order (onError → onNormalized → onRouted)
 *  - modal errors are rendered into document.body via React's createRoot
 *  - toast errors reach the Sonner Toaster that is mounted in the DOM
 *  - clearAll tears down all active UI artefacts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createErrorEngine } from "../../engine";
import { createSonnerAdapter, SonnerToaster } from "../../adapters/sonner";

// ---------------------------------------------------------------------------
// Shared cleanup
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset any modals the adapter may have appended directly to document.body
  // outside of @testing-library's managed container.
  document.body.innerHTML = "";
});

afterEach(() => {
  // Unmount anything rendered via @testing-library/react.
  cleanup();
});

// ---------------------------------------------------------------------------
// Lifecycle hooks order
// ---------------------------------------------------------------------------

describe("Lifecycle hooks order", () => {
  it("onError → onNormalized → onRouted fire in the correct sequence", () => {
    const order: string[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: { NOT_FOUND: { ui: "toast", message: "Not found" } },
      renderer: adapter,
      onError: () => order.push("onError"),
      onNormalized: () => order.push("onNormalized"),
      onRouted: () => order.push("onRouted"),
    });

    engine.handle({ code: "NOT_FOUND" });

    expect(order).toEqual(["onError", "onNormalized", "onRouted"]);
  });

  it("onError receives the original raw value before normalisation", () => {
    const captured: unknown[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: { NOT_FOUND: { ui: "toast" } },
      renderer: adapter,
      onError: (raw) => captured.push(raw),
    });

    const rawError = new Error("something broke");
    engine.handle(rawError);

    expect(captured[0]).toBe(rawError);
  });

  it("onNormalized receives the fully normalised AppError", () => {
    const normalised: unknown[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: { NOT_FOUND: { ui: "toast", message: "Not found" } },
      renderer: adapter,
      onNormalized: (err) => normalised.push(err),
    });

    engine.handle({ code: "NOT_FOUND" });

    expect(normalised[0]).toMatchObject({ code: "NOT_FOUND" });
  });

  it("onRouted receives the error and the resolved UIAction", () => {
    const routedCalls: Array<{ code: string; action: string }> = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: { NOT_FOUND: { ui: "toast", message: "Not found" } },
      renderer: adapter,
      onRouted: (err, action) => routedCalls.push({ code: err.code, action }),
    });

    engine.handle({ code: "NOT_FOUND" });

    expect(routedCalls[0]).toEqual({ code: "NOT_FOUND", action: "toast" });
  });
});

// ---------------------------------------------------------------------------
// Modal DOM rendering
// ---------------------------------------------------------------------------

describe("Modal DOM rendering", () => {
  it("renders modal content into document.body", async () => {
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {
        AUTH_REQUIRED: { ui: "modal", message: "Authentication required" },
      },
      renderer: adapter,
    });

    await act(async () => {
      engine.handle({ code: "AUTH_REQUIRED" });
    });

    expect(document.body.textContent).toContain("Authentication required");
  });

  it("modal contains a Dismiss button", async () => {
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {
        AUTH_REQUIRED: { ui: "modal", message: "Please authenticate" },
      },
      renderer: adapter,
    });

    await act(async () => {
      engine.handle({ code: "AUTH_REQUIRED" });
    });

    const btn = document.body.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("Dismiss");
  });

  it("clearAll removes the modal from document.body", async () => {
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {
        AUTH_REQUIRED: { ui: "modal", message: "Please authenticate" },
      },
      renderer: adapter,
    });

    await act(async () => {
      engine.handle({ code: "AUTH_REQUIRED" });
    });
    expect(document.body.textContent).toContain("Please authenticate");

    await act(async () => {
      engine.clearAll();
    });
    expect(document.body.textContent).not.toContain("Please authenticate");
  });

  it("lifecycle hooks still fire for modal-routed errors", async () => {
    const order: string[] = [];
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {
        AUTH_REQUIRED: { ui: "modal", message: "Please log in" },
      },
      renderer: adapter,
      onError: () => order.push("onError"),
      onNormalized: () => order.push("onNormalized"),
      onRouted: () => order.push("onRouted"),
    });

    await act(async () => {
      engine.handle({ code: "AUTH_REQUIRED" });
    });

    expect(order).toEqual(["onError", "onNormalized", "onRouted"]);
  });
});

// ---------------------------------------------------------------------------
// Toast DOM rendering (requires mounted SonnerToaster)
// ---------------------------------------------------------------------------

describe("Toast DOM rendering", () => {
  it("renders a toast notification in the DOM when SonnerToaster is mounted", async () => {
    const adapter = createSonnerAdapter();
    const engine = createErrorEngine({
      registry: {
        NOT_FOUND: { ui: "toast", message: "Resource not found" },
      },
      renderer: adapter,
    });

    // Mount the Toaster so Sonner has a container in which to display toasts.
    render(<SonnerToaster />);

    await act(async () => {
      engine.handle({ code: "NOT_FOUND" });
    });

    // findByText uses waitFor internally, allowing React to flush state updates.
    const toastEl = await screen.findByText("Resource not found");
    expect(toastEl).toBeTruthy();
  });
});
