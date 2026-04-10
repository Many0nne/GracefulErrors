import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, onMounted } from "vue";
import { mount } from "@vue/test-utils";
import {
  createErrorEnginePlugin,
  provideErrorEngine,
  useErrorEngine,
  useFieldError,
  ErrorBoundaryWithEngine,
} from "../vue";
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
// createErrorEnginePlugin + useErrorEngine
// ---------------------------------------------------------------------------

describe("createErrorEnginePlugin + useErrorEngine", () => {
  it("plugin provides engine globally — hook returns it", () => {
    const engine = makeEngine();
    let captured: ErrorEngine | null = null;

    const Consumer = defineComponent({
      setup() {
        captured = useErrorEngine();
        return () => null;
      },
    });

    mount(Consumer, {
      global: { plugins: [createErrorEnginePlugin(engine)] },
    });

    expect(captured).toBe(engine);
  });
});

// ---------------------------------------------------------------------------
// provideErrorEngine + useErrorEngine
// ---------------------------------------------------------------------------

describe("provideErrorEngine + useErrorEngine", () => {
  it("local provide — hook returns engine in subtree", () => {
    const engine = makeEngine();
    let captured: ErrorEngine | null = null;

    const Consumer = defineComponent({
      setup() {
        captured = useErrorEngine();
        return () => null;
      },
    });

    const Parent = defineComponent({
      setup() {
        provideErrorEngine(engine);
        return () => h(Consumer);
      },
    });

    mount(Parent);

    expect(captured).toBe(engine);
  });

  it("no provider — useErrorEngine returns null and logs in dev", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const origEnv = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "development";

    let captured: ErrorEngine | null =
      undefined as unknown as ErrorEngine | null;

    const Consumer = defineComponent({
      setup() {
        captured = useErrorEngine();
        return () => null;
      },
    });

    mount(Consumer);

    expect(captured).toBeNull();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("[gracefulerrors]"),
    );

    spy.mockRestore();
    process.env["NODE_ENV"] = origEnv;
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

  function makeFieldConsumer(field: string) {
    return defineComponent({
      setup() {
        const { error } = useFieldError(field);
        return () =>
          h(
            "div",
            { "data-testid": "error" },
            error.value ? error.value.code : "none",
          );
      },
    });
  }

  function wrapWithProvider(
    engine: ErrorEngine,
    child: ReturnType<typeof defineComponent>,
  ) {
    return defineComponent({
      setup() {
        provideErrorEngine(engine);
        return () => h(child);
      },
    });
  }

  it("initial state — returns null", () => {
    const engine = makeSubscribableEngine();
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));
    expect(wrapper.find('[data-testid="error"]').text()).toBe("none");
  });

  it("ERROR_ADDED inline with matching field — updates error", async () => {
    const engine = makeSubscribableEngine();
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));

    emit({
      type: "ERROR_ADDED",
      action: "inline",
      error: { code: "EMAIL_INVALID", context: { field: "email" } },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="error"]').text()).toBe("EMAIL_INVALID");
  });

  it("ERROR_ADDED inline with different field — error state unchanged", async () => {
    const engine = makeSubscribableEngine();
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));

    emit({
      type: "ERROR_ADDED",
      action: "inline",
      error: { code: "OTHER_ERR", context: { field: "password" } },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="error"]').text()).toBe("none");
  });

  it("ERROR_ADDED non-inline action — error state unchanged", async () => {
    const engine = makeSubscribableEngine();
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));

    emit({
      type: "ERROR_ADDED",
      action: "toast",
      error: { code: "EMAIL_INVALID", context: { field: "email" } },
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="error"]').text()).toBe("none");
  });

  it("ALL_CLEARED — clears error", async () => {
    const engine = makeSubscribableEngine();
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));

    emit({
      type: "ERROR_ADDED",
      action: "inline",
      error: { code: "EMAIL_INVALID", context: { field: "email" } },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="error"]').text()).toBe("EMAIL_INVALID");

    emit({ type: "ALL_CLEARED" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="error"]').text()).toBe("none");
  });

  it("ERROR_CLEARED with matching code — clears error", async () => {
    const engine = makeSubscribableEngine();
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));

    emit({
      type: "ERROR_ADDED",
      action: "inline",
      error: { code: "EMAIL_INVALID", context: { field: "email" } },
    });
    await wrapper.vm.$nextTick();

    emit({ type: "ERROR_CLEARED", code: "EMAIL_INVALID" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="error"]').text()).toBe("none");
  });

  it("ERROR_CLEARED with non-matching code — error state unchanged", async () => {
    const engine = makeSubscribableEngine();
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));

    emit({
      type: "ERROR_ADDED",
      action: "inline",
      error: { code: "EMAIL_INVALID", context: { field: "email" } },
    });
    await wrapper.vm.$nextTick();

    emit({ type: "ERROR_CLEARED", code: "OTHER_CODE" });
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="error"]').text()).toBe("EMAIL_INVALID");
  });

  it("unmount — unsubscribe is called", () => {
    const unsubscribe = vi.fn();
    const engine = makeEngine({
      subscribe: vi.fn().mockReturnValue(unsubscribe),
    });
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(wrapWithProvider(engine, FieldConsumer));
    wrapper.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("no provider — returns null without crash", () => {
    const FieldConsumer = makeFieldConsumer("email");
    const wrapper = mount(FieldConsumer);
    expect(wrapper.find('[data-testid="error"]').text()).toBe("none");
  });
});

// ---------------------------------------------------------------------------
// ErrorBoundaryWithEngine
// ---------------------------------------------------------------------------

describe("ErrorBoundaryWithEngine", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  const ThrowingChild = defineComponent({
    props: { shouldThrow: Boolean },
    setup(props) {
      onMounted(() => {
        if (props.shouldThrow) throw new Error("boom");
      });
      return () => h("div", "OK");
    },
  });

  it("renders children when no error", () => {
    const wrapper = mount(ErrorBoundaryWithEngine, {
      props: { fallback: "Error fallback" },
      slots: { default: () => h(ThrowingChild, { shouldThrow: false }) },
    });
    expect(wrapper.text()).toContain("OK");
  });

  it("when child throws — renders fallback string", async () => {
    const wrapper = mount(ErrorBoundaryWithEngine, {
      props: { fallback: "Error fallback" },
      slots: { default: () => h(ThrowingChild, { shouldThrow: true }) },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Error fallback");
  });

  it("when child throws — renders fallback slot", async () => {
    const wrapper = mount(ErrorBoundaryWithEngine, {
      slots: {
        default: () => h(ThrowingChild, { shouldThrow: true }),
        fallback: () => h("div", "slot fallback"),
      },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("slot fallback");
  });

  it("captured error is forwarded to engine.handle", async () => {
    const engine = makeEngine();

    const Parent = defineComponent({
      setup() {
        provideErrorEngine(engine);
        return () =>
          h(
            ErrorBoundaryWithEngine,
            { fallback: "fallback" },
            {
              default: () => h(ThrowingChild, { shouldThrow: true }),
            },
          );
      },
    });

    const wrapper = mount(Parent);
    await wrapper.vm.$nextTick();
    expect(engine.handle).toHaveBeenCalledWith(expect.any(Error));
  });

  it("no provider — renders fallback, no engine call, no crash", async () => {
    const wrapper = mount(ErrorBoundaryWithEngine, {
      props: { fallback: "fallback" },
      slots: { default: () => h(ThrowingChild, { shouldThrow: true }) },
    });
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("fallback");
  });
});
