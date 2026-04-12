import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createSonnerAdapter } from "../../adapters/sonner";
import type { RenderIntent } from "../../types";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before vi.mock calls)
// ---------------------------------------------------------------------------

const { mockToastError, mockToastWarning, mockToastDismiss, mockRender } =
  vi.hoisted(() => ({
    mockToastError: vi.fn().mockReturnValue("toast-id-1"),
    mockToastWarning: vi.fn().mockReturnValue("toast-id-2"),
    mockToastDismiss: vi.fn(),
    mockRender: vi.fn(),
  }));

vi.mock("sonner", () => ({
  toast: Object.assign(mockToastError, {
    error: mockToastError,
    warning: mockToastWarning,
    info: vi.fn().mockReturnValue("toast-id-3"),
    success: vi.fn().mockReturnValue("toast-id-4"),
    dismiss: mockToastDismiss,
  }),
  Toaster: () => null,
}));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({
    render: mockRender,
    unmount: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIntent(overrides: Partial<RenderIntent> = {}): RenderIntent {
  return {
    ui: "toast",
    error: { code: "ERR", message: "Something went wrong" },
    entry: { ui: "toast" },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Toast rendering
// ---------------------------------------------------------------------------

describe("createSonnerAdapter — toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToastError.mockReturnValue("toast-id-1");
    mockToastWarning.mockReturnValue("toast-id-2");
  });

  it("ui === toast → toast.error called with message", () => {
    const adapter = createSonnerAdapter();
    adapter.render(makeIntent({ ui: "toast" }), {});
    expect(mockToastError).toHaveBeenCalledWith(
      "Something went wrong",
      expect.any(Object),
    );
  });

  it("entry.uiOptions.severity === warning → toast.warning called", () => {
    const adapter = createSonnerAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        entry: { ui: "toast", uiOptions: { severity: "warning" } },
      }),
      {},
    );
    expect(mockToastWarning).toHaveBeenCalled();
  });

  it("entry.uiOptions.duration → passed to sonner", () => {
    const adapter = createSonnerAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        entry: { ui: "toast", uiOptions: { duration: 8000 } },
      }),
      {},
    );
    expect(mockToastError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ duration: 8000 }),
    );
  });

  it("default position → top-right when uiOptions.position is not set", () => {
    const adapter = createSonnerAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        entry: { ui: "toast" },
      }),
      {},
    );
    expect(mockToastError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ position: "top-right" }),
    );
  });

  it("entry.message function → called with error, result used as message", () => {
    const adapter = createSonnerAdapter();
    const error = { code: "ERR", message: "raw" };
    const messageFn = vi.fn().mockReturnValue("resolved message");
    adapter.render(
      makeIntent({
        ui: "toast",
        error,
        entry: { ui: "toast", message: messageFn },
      }),
      {},
    );
    expect(messageFn).toHaveBeenCalledWith(error);
    expect(mockToastError).toHaveBeenCalledWith(
      "resolved message",
      expect.any(Object),
    );
  });

  it('fallback message: no entry.message, no error.message → "An error occurred"', () => {
    const adapter = createSonnerAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        error: { code: "ERR" },
        entry: { ui: "toast" },
      }),
      {},
    );
    expect(mockToastError).toHaveBeenCalledWith(
      "An error occurred",
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// Modal rendering
// ---------------------------------------------------------------------------

describe("createSonnerAdapter — modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("ui === modal → createRoot called, modal rendered", () => {
    const adapter = createSonnerAdapter();
    adapter.render(makeIntent({ ui: "modal", entry: { ui: "modal" } }), {});
    expect(mockRender).toHaveBeenCalled();
  });

  it("ui === inline → no-op, no sonner call", () => {
    const adapter = createSonnerAdapter();
    adapter.render(makeIntent({ ui: "inline", entry: { ui: "inline" } }), {});
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("ui === silent → no-op", () => {
    const adapter = createSonnerAdapter();
    adapter.render(makeIntent({ ui: "silent", entry: { ui: "silent" } }), {});
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clear / clearAll
// ---------------------------------------------------------------------------

describe("createSonnerAdapter — clear / clearAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToastError.mockReturnValue("toast-id-1");
  });

  it("clear(code) — calls toast.dismiss with stored ID", () => {
    const adapter = createSonnerAdapter();
    mockToastError.mockReturnValueOnce("my-toast-id");
    adapter.render(
      makeIntent({
        ui: "toast",
        error: { code: "ERR_A", message: "x" },
        entry: { ui: "toast" },
      }),
      {},
    );
    adapter.clear("ERR_A");
    expect(mockToastDismiss).toHaveBeenCalledWith("my-toast-id");
  });

  it("clear(code) — unknown code, no error thrown", () => {
    const adapter = createSonnerAdapter();
    expect(() => adapter.clear("UNKNOWN")).not.toThrow();
  });

  it("clearAll() — calls toast.dismiss() with no args", () => {
    const adapter = createSonnerAdapter();
    adapter.clearAll();
    expect(mockToastDismiss).toHaveBeenCalledWith();
  });
});

// ---------------------------------------------------------------------------
// ModalDialog — accessibility (ARIA attributes + keyboard interaction)
// ---------------------------------------------------------------------------

describe("ModalDialog — accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  function renderModalTree(onDismiss = vi.fn()) {
    const adapter = createSonnerAdapter();
    adapter.render(makeIntent({ ui: "modal", entry: { ui: "modal" } }), {
      onDismiss,
    });
    const renderedTree = mockRender.mock.calls[0]?.[0];
    return { renderedTree, onDismiss };
  }

  it("dialog has role='dialog' and aria-modal='true'", () => {
    const { renderedTree } = renderModalTree();
    const { container } = render(renderedTree);

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
  });

  it("dialog has aria-labelledby pointing to the message element", () => {
    const { renderedTree } = renderModalTree();
    const { container } = render(renderedTree);

    const dialog = container.querySelector('[role="dialog"]');
    const labelledBy = dialog?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    // useId generates IDs like ":r0:" — use attribute selector to avoid CSS
    // pseudo-class conflicts in querySelector.
    const labelEl = container.querySelector(`[id="${labelledBy}"]`);
    expect(labelEl).not.toBeNull();
    expect(labelEl?.textContent).toContain("Something went wrong");
  });

  it("dismiss button has aria-label='Close error'", () => {
    const { renderedTree } = renderModalTree();
    render(renderedTree);

    const closeBtn = screen.getByRole("button", { name: "Close error" });
    expect(closeBtn).toBeTruthy();
  });

  it("Escape key triggers onDismiss", () => {
    const onDismiss = vi.fn();
    const { renderedTree } = renderModalTree(onDismiss);
    render(renderedTree);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("Tab from the last focusable element wraps focus back to the first", () => {
    const { renderedTree } = renderModalTree();
    const { container } = render(renderedTree);

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const closeBtn = screen.getByRole("button", { name: "Close error" });

    // Only one focusable element: first === last.
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(dialog, { key: "Tab" });
    // focus stays on the single focusable element
    expect(document.activeElement).toBe(closeBtn);
  });

  it("Shift+Tab from the first focusable element wraps focus to the last", () => {
    const { renderedTree } = renderModalTree();
    const { container } = render(renderedTree);

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const closeBtn = screen.getByRole("button", { name: "Close error" });

    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(closeBtn);
  });

  it("focus is restored to the previously focused element on dismiss", () => {
    const previousButton = document.createElement("button");
    document.body.appendChild(previousButton);
    previousButton.focus();
    expect(document.activeElement).toBe(previousButton);

    const { renderedTree } = renderModalTree();
    const { unmount } = render(renderedTree);

    act(() => {
      unmount();
    });

    expect(document.activeElement).toBe(previousButton);
    document.body.removeChild(previousButton);
  });
});
