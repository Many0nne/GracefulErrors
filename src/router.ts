import type {
  AppError,
  ErrorEngineConfig,
  ErrorRegistryEntryFull,
  ErrorRegistry,
  UIAction,
  UIRouter,
} from "./types";

export function createUIRouter<
  TCode extends string,
  TField extends string = string,
>(): UIRouter<TCode, TField> {
  function route(
    error: AppError<TCode, TField>,
    registry: ErrorRegistry<TCode>,
    config: Pick<
      ErrorEngineConfig<TCode, TField>,
      "fallback" | "requireRegistry" | "allowFallback" | "routingStrategy"
    > & {
      routingContext?: { activeCount: number; queueLength: number };
      resolvedEntry?: ErrorRegistryEntryFull<TCode>;
    },
  ): UIAction | null {
    const entry = config.resolvedEntry;

    if (entry == null && config.requireRegistry) {
      throw new Error(
        `[gracefulerrors] Registry entry required for code: ${error.code}`,
      );
    }

    const routingContext = config.routingContext ?? {
      activeCount: 0,
      queueLength: 0,
    };

    let strategyResult: UIAction | null | undefined;
    if (config.routingStrategy) {
      try {
        strategyResult = config.routingStrategy(error, entry, routingContext);
      } catch (err) {
        if (process.env["NODE_ENV"] !== "production") {
          console.error("[gracefulerrors] routingStrategy threw:", err);
        }
        strategyResult = null;
      }
    }

    // routingStrategy returns non-null → use it (overrides registry)
    if (strategyResult != null) {
      return strategyResult;
    }

    // Registry entry exists → use its ui
    if (entry != null) {
      return entry.ui;
    }

    // No match — apply fallback logic
    // allowFallback defaults to true
    const allowFallback = config.allowFallback !== false;

    if (allowFallback && config.fallback) {
      return config.fallback.ui;
    }

    return "toast";
  }

  return { route };
}

export type { UIRouter } from "./types";
