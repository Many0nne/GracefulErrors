import {
  inject,
  provide,
  ref,
  onMounted,
  onUnmounted,
  defineComponent,
  h,
  onErrorCaptured,
} from "vue";
import type { InjectionKey, Plugin, Ref, VNode } from "vue";
import type { ErrorEngine, AppError, StateListener } from "./types";

export const ErrorEngineKey: InjectionKey<ErrorEngine> = Symbol("ErrorEngine");

function resolveErrorEngine<
  TCode extends string = string,
>(): ErrorEngine<TCode> | null {
  return inject(ErrorEngineKey, null) as ErrorEngine<TCode> | null;
}

export function createErrorEnginePlugin<TCode extends string = string>(
  engine: ErrorEngine<TCode>,
): Plugin {
  return {
    install(app) {
      app.provide(ErrorEngineKey, engine);
      const originalUnmount = app.unmount.bind(app);
      app.unmount = () => {
        engine.destroy();
        originalUnmount();
      };
    },
  };
}

export function provideErrorEngine<TCode extends string = string>(
  engine: ErrorEngine<TCode>,
): void {
  provide(ErrorEngineKey, engine);
}

export function useErrorEngine<
  TCode extends string = string,
>(): ErrorEngine<TCode> | null {
  const engine = resolveErrorEngine<TCode>();
  if (!engine && process.env["NODE_ENV"] === "development") {
    console.error(
      "[gracefulerrors] useErrorEngine called outside of a provider (ErrorEngineKey not found).",
    );
  }
  return engine;
}

export function useFieldError<TField extends string = string>(
  field: TField,
): { error: Ref<AppError<string, TField> | null> } {
  const engine = useErrorEngine();
  const error = ref<AppError<string, TField> | null>(null) as Ref<AppError<
    string,
    TField
  > | null>;
  let unsubscribe: (() => void) | null = null;

  onMounted(() => {
    if (!engine) return;
    unsubscribe = engine.subscribe((event: Parameters<StateListener>[0]) => {
      if (event.type === "ERROR_ADDED" && event.action === "inline") {
        if (event.error.context?.field === field) {
          error.value = event.error as AppError<string, TField>;
        }
      } else if (event.type === "ERROR_CLEARED") {
        if (error.value?.code === event.code) {
          error.value = null;
        }
      } else if (event.type === "ALL_CLEARED") {
        error.value = null;
      }
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  return { error };
}

export const ErrorBoundaryWithEngine = defineComponent({
  name: "ErrorBoundaryWithEngine",
  props: {
    fallback: {
      // Vue's prop system requires runtime type constructors ([String, Object]) for runtime
      // validation, but the TypeScript declaration needs the actual prop type signature.
      // This pattern is the standard Vue workaround for typed props with multiple runtime types.
      type: [String, Object] as unknown as () => string | VNode,
      default: null,
    },
  },
  setup(props, { slots }) {
    const engine = resolveErrorEngine();
    const hasError = ref(false);

    onErrorCaptured((err: unknown) => {
      engine?.handle(err);
      hasError.value = true;
      return false;
    });

    return () => {
      if (hasError.value) {
        if (slots.fallback) return slots.fallback();
        if (props.fallback) {
          return typeof props.fallback === "string"
            ? h("span", props.fallback)
            : (props.fallback as VNode);
        }
        return null;
      }
      return slots.default?.();
    };
  },
});
