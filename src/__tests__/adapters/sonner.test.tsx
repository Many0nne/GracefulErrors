import { describe, it, expect, vi, beforeEach } from "vitest";
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
