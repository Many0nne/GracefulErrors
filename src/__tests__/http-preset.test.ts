import { describe, it, expect } from "vitest";
import { createHttpPreset } from "../http-preset";

describe("createHttpPreset", () => {
  it("returns all 11 HTTP codes by default", () => {
    const preset = createHttpPreset();
    const codes = [
      "HTTP_400",
      "HTTP_401",
      "HTTP_403",
      "HTTP_404",
      "HTTP_409",
      "HTTP_422",
      "HTTP_429",
      "HTTP_500",
      "HTTP_502",
      "HTTP_503",
      "HTTP_504",
    ];
    for (const code of codes) {
      expect(preset[code as keyof typeof preset]).toBeDefined();
    }
  });

  it("HTTP_401 defaults to modal with dismissible: false", () => {
    const preset = createHttpPreset();
    const entry = preset["HTTP_401"]!;
    expect(entry.ui).toBe("modal");
    expect(
      (entry as { uiOptions?: { dismissible?: boolean } }).uiOptions
        ?.dismissible,
    ).toBe(false);
  });

  it("HTTP_500 defaults to toast error", () => {
    const preset = createHttpPreset();
    const entry = preset["HTTP_500"]!;
    expect(entry.ui).toBe("toast");
    expect(
      (entry as { uiOptions?: { severity?: string } }).uiOptions?.severity,
    ).toBe("error");
  });

  it("HTTP_400 defaults to toast warning", () => {
    const preset = createHttpPreset();
    const entry = preset["HTTP_400"]!;
    expect(entry.ui).toBe("toast");
    expect(
      (entry as { uiOptions?: { severity?: string } }).uiOptions?.severity,
    ).toBe("warning");
  });

  it("overrides a specific code", () => {
    const preset = createHttpPreset({
      HTTP_401: {
        ui: "toast",
        message: "Session expired. Please log in again.",
      },
    });
    const entry = preset["HTTP_401"]!;
    expect(entry.ui).toBe("toast");
    expect(entry.message).toBe("Session expired. Please log in again.");
  });

  it("preserves non-overridden codes when overrides are provided", () => {
    const preset = createHttpPreset({
      HTTP_401: { ui: "toast", message: "Custom" },
    });
    expect(preset["HTTP_500"]?.ui).toBe("toast");
    expect(preset["HTTP_403"]?.ui).toBe("toast");
  });

  it("does not mutate the defaults on successive calls", () => {
    const first = createHttpPreset({
      HTTP_400: { ui: "modal", message: "Changed" },
    });
    const second = createHttpPreset();
    expect(second["HTTP_400"]?.ui).toBe("toast");
    expect(first["HTTP_400"]?.ui).toBe("modal");
  });

  it("returns a plain registry usable with spread in createErrorEngine config", () => {
    const preset = createHttpPreset();
    const registry = {
      ...preset,
      PAYMENT_FAILED: {
        ui: "modal" as const,
        message: "Payment could not be processed.",
      },
    };
    expect(registry["PAYMENT_FAILED"]?.ui).toBe("modal");
    expect(registry["HTTP_404"]).toBeDefined();
  });
});
