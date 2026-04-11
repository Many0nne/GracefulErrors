import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createHotToastAdapter } from "../../adapters/react-hot-toast";
import type { RenderIntent } from "../../types";

// ---------------------------------------------------------------------------
// Hoisted mocks (must be declared before vi.mock calls)
// ---------------------------------------------------------------------------

const {
  mockToast,
  mockToastError,
  mockToastSuccess,
  mockToastDismiss,
  mockRender,
} = vi.hoisted(() => ({
  mockToast: vi.fn().mockReturnValue("toast-id-1"),
  mockToastError: vi.fn().mockReturnValue("toast-id-2"),
  mockToastSuccess: vi.fn().mockReturnValue("toast-id-3"),
  mockToastDismiss: vi.fn(),
  mockRender: vi.fn(),
}));

vi.mock("react-hot-toast", () => {
  const toastFn = Object.assign(mockToast, {
    error: mockToastError,
    success: mockToastSuccess,
    dismiss: mockToastDismiss,
  });
  return {
    default: toastFn,
    Toaster: () => null,
  };
});

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

describe("createHotToastAdapter — toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockReturnValue("toast-id-1");
    mockToastError.mockReturnValue("toast-id-2");
    mockToastSuccess.mockReturnValue("toast-id-3");
  });

  it("ui === toast → toast.error called with message by default", () => {
    const adapter = createHotToastAdapter();
    adapter.render(makeIntent({ ui: "toast" }), {});
    expect(mockToastError).toHaveBeenCalledWith(
      "Something went wrong",
      expect.any(Object),
    );
  });

  it("entry.uiOptions.severity === success → toast.success called", () => {
    const adapter = createHotToastAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        entry: { ui: "toast", uiOptions: { severity: "success" } },
      }),
      {},
    );
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("entry.uiOptions.severity === warning → toast() called with ⚠️ icon", () => {
    const adapter = createHotToastAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        entry: { ui: "toast", uiOptions: { severity: "warning" } },
      }),
      {},
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ icon: "⚠️" }),
    );
  });

  it("entry.uiOptions.severity === info → toast() called with ℹ️ icon", () => {
    const adapter = createHotToastAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        entry: { ui: "toast", uiOptions: { severity: "info" } },
      }),
      {},
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ icon: "ℹ️" }),
    );
  });

  it("entry.uiOptions.icon overrides default icon for warning", () => {
    const adapter = createHotToastAdapter();
    adapter.render(
      makeIntent({
        ui: "toast",
        entry: { ui: "toast", uiOptions: { severity: "warning", icon: "🔔" } },
      }),
      {},
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ icon: "🔔" }),
    );
  });

  it("entry.uiOptions.duration → passed to react-hot-toast", () => {
    const adapter = createHotToastAdapter();
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

  it("entry.message function → called with error, result used as message", () => {
    const adapter = createHotToastAdapter();
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
    const adapter = createHotToastAdapter();
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

describe("createHotToastAdapter — modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("ui === modal → createRoot called, modal rendered", () => {
    const adapter = createHotToastAdapter();
    adapter.render(makeIntent({ ui: "modal", entry: { ui: "modal" } }), {});
    expect(mockRender).toHaveBeenCalled();
  });

  it("dismissible modal backdrop is keyboard-focusable and Enter dismisses", () => {
    const adapter = createHotToastAdapter();
    const onDismiss = vi.fn();

    adapter.render(makeIntent({ ui: "modal", entry: { ui: "modal" } }), {
      onDismiss,
    });

    const renderedTree = mockRender.mock.calls[0]?.[0];
    expect(renderedTree).toBeTruthy();
    render(renderedTree);

    const backdrop = screen.getByRole("button", {
      name: "Dismiss modal overlay",
    });
    expect(backdrop.getAttribute("tabindex")).toBe("0");

    fireEvent.keyDown(backdrop, { key: "Enter" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("non-dismissible modal backdrop is not keyboard interactive", () => {
    const adapter = createHotToastAdapter();

    adapter.render(
      makeIntent({
        ui: "modal",
        entry: { ui: "modal", uiOptions: { dismissible: false } },
      }),
      {},
    );

    const renderedTree = mockRender.mock.calls[0]?.[0];
    expect(renderedTree).toBeTruthy();
    render(renderedTree);

    expect(
      screen.queryByRole("button", { name: "Dismiss modal overlay" }),
    ).toBeNull();
  });

  it("ui === inline → no-op, no toast call", () => {
    const adapter = createHotToastAdapter();
    adapter.render(makeIntent({ ui: "inline", entry: { ui: "inline" } }), {});
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });

  it("ui === silent → no-op", () => {
    const adapter = createHotToastAdapter();
    adapter.render(makeIntent({ ui: "silent", entry: { ui: "silent" } }), {});
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clear / clearAll
// ---------------------------------------------------------------------------

describe("createHotToastAdapter — clear / clearAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockToastError.mockReturnValue("toast-id-2");
  });

  it("clear(code) — calls toast.dismiss with stored ID", () => {
    const adapter = createHotToastAdapter();
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
    const adapter = createHotToastAdapter();
    expect(() => adapter.clear("UNKNOWN")).not.toThrow();
  });

  it("clearAll() — calls toast.dismiss() with no args", () => {
    const adapter = createHotToastAdapter();
    adapter.clearAll();
    expect(mockToastDismiss).toHaveBeenCalledWith();
  });
});
