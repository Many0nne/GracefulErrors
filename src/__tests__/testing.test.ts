import { describe, it, expect } from "vitest";
import { createMockEngine } from "../testing";
import type { ErrorRegistry } from "../types";

type Code = "AUTH_FAILED" | "NOT_FOUND" | "SERVER_ERROR";

const registry: ErrorRegistry<Code> = {
  AUTH_FAILED: { ui: "toast", message: "Unauthorized" },
  NOT_FOUND: { ui: "modal", message: "Not found" },
  SERVER_ERROR: { ui: "silent" },
};

describe("createMockEngine", () => {
  it("records handle calls", () => {
    const engine = createMockEngine<Code>({ registry });

    engine.handle({ code: "AUTH_FAILED", message: "401" });

    expect(engine.calls).toHaveLength(1);
    expect(engine.calls[0].error.code).toBe("AUTH_FAILED");
    expect(engine.calls[0].uiAction).toBe("toast");
  });

  it("routes to the correct uiAction per registry entry", () => {
    const engine = createMockEngine<Code>({ registry });

    engine.handle({ code: "NOT_FOUND" });

    expect(engine.calls[0].uiAction).toBe("modal");
  });

  it("returns 'silent' uiAction for silent routing", () => {
    const engine = createMockEngine<Code>({ registry });

    engine.handle({ code: "SERVER_ERROR" });

    expect(engine.calls[0].uiAction).toBe("silent");
  });

  it("defaults to toast when no registry entry matches", () => {
    const engine = createMockEngine();

    engine.handle({ code: "UNKNOWN_CODE" });

    expect(engine.calls[0].uiAction).toBe("toast");
  });

  it("accumulates multiple calls", () => {
    const engine = createMockEngine<Code>({ registry });

    engine.handle({ code: "AUTH_FAILED" });
    engine.handle({ code: "NOT_FOUND" });

    expect(engine.calls).toHaveLength(2);
    expect(engine.calls[1].error.code).toBe("NOT_FOUND");
  });

  it("reset() clears the calls array", () => {
    const engine = createMockEngine<Code>({ registry });

    engine.handle({ code: "AUTH_FAILED" });
    expect(engine.calls).toHaveLength(1);

    engine.reset();
    expect(engine.calls).toHaveLength(0);
  });

  it("returns HandleResult with handled: true", () => {
    const engine = createMockEngine<Code>({ registry });

    const result = engine.handle({ code: "AUTH_FAILED" });

    expect(result).toMatchObject({
      handled: true,
      error: expect.objectContaining({ code: "AUTH_FAILED" }),
      uiAction: "toast",
    });
  });

  it("uses fallback config when no registry entry matches", () => {
    const engine = createMockEngine<Code>({
      registry,
      fallback: { ui: "modal" },
    });

    engine.handle({ code: "SOME_OTHER" as Code });

    expect(engine.calls[0].uiAction).toBe("modal");
  });

  it("normalizes raw Error objects", () => {
    const engine = createMockEngine();

    engine.handle(new TypeError("Network failure"));

    expect(engine.calls[0].error.code).toBe("NETWORK_ERROR");
  });

  it("accepts custom normalizers", () => {
    const engine = createMockEngine({
      normalizers: [
        (raw) => {
          if (raw === "my-sentinel")
            return { code: "CUSTOM", message: "from normalizer" };
          return null;
        },
      ],
    });

    // 'my-sentinel' is a plain string — built-in normalizer returns null for it,
    // so the custom normalizer result is preserved.
    engine.handle("my-sentinel");

    expect(engine.calls[0].error.code).toBe("CUSTOM");
  });
});
