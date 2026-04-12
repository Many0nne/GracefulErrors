/**
 * gracefulerrors/server
 *
 * Timer-free, renderer-free engine for server-side usage (Next.js, Nuxt, Remix, plain Node.js).
 *
 * Key differences from createErrorEngine:
 * - No setTimeout anywhere — safe to call in SSR render functions and edge runtimes
 * - No renderer — no DOM/browser dependencies
 * - No state queue — each .handle() call is stateless; instantiate per-request
 * - No aggregation/dedupeWindow — timer-based burst suppression has no meaning per-request
 * - Reporters still fire so errors reach Sentry / Datadog / webhooks server-side
 * - Lifecycle hooks (onError, onNormalized, onRouted, …) all work as usual
 * - History tracking works for post-request debug inspection
 *
 * ## Per-request usage (recommended)
 *
 * Create a fresh engine instance inside each request handler to avoid leaking
 * state between concurrent requests:
 *
 * ```ts
 * // lib/engine.ts
 * import { createServerEngine } from "gracefulerrors/server";
 * import { myReporter } from "./reporters";
 *
 * export function makeRequestEngine() {
 *   return createServerEngine({
 *     registry: { NOT_FOUND: { ui: "toast", message: "Not found" } },
 *     reporters: [myReporter],
 *   });
 * }
 * ```
 *
 * See docs/ssr.md for framework-specific integration guides.
 */

import { runNormalizerPipeline, builtInNormalizer } from "./normalizer";
import { createUIRouter } from "./router";
import { lookupEntry } from "./registry";
import type {
  AppError,
  ServerErrorEngineConfig,
  ServerErrorEngine,
  HandleResult,
  HistoryEntry,
  UIAction,
  ErrorRegistryEntryFull,
  Normalizer,
  ReporterContext,
  TransformResult,
  SuppressionDecision,
  TransformContext,
} from "./types";

// ---------------------------------------------------------------------------
// Internal helpers (duplicated from engine.ts — intentionally not shared to
// keep the server bundle fully independent from the full engine)
// ---------------------------------------------------------------------------

function isSuppressionDecision(
  result: TransformResult,
): result is SuppressionDecision {
  return (
    result !== null &&
    typeof result === "object" &&
    "suppress" in result &&
    result.suppress === true
  );
}

function safeCall<T extends unknown[]>(
  fn: ((...args: T) => unknown) | undefined,
  ...args: T
): void {
  if (!fn) return;
  try {
    fn(...args);
  } catch (err) {
    if (process.env["NODE_ENV"] !== "production") {
      console.error("[gracefulerrors/server] Hook threw:", err);
    }
  }
}

function safeTransform<TCode extends string, TField extends string>(
  fn: ServerErrorEngineConfig<TCode, TField>["transform"],
  error: AppError<TCode, TField>,
): TransformResult<TCode, TField> {
  if (!fn) return null;
  try {
    return fn(error, { raw: error.raw } as TransformContext);
  } catch (err) {
    if (process.env["NODE_ENV"] !== "production") {
      console.error("[gracefulerrors/server] transform threw:", err);
    }
    return null;
  }
}

function defaultFingerprint(error: AppError): string {
  return `${error.code}:${error.status ?? ""}:${error.context?.field ?? ""}`;
}

function noOpNormalizer<C extends string, F extends string>(
  _raw: unknown,
  current: AppError<C, F> | null,
): AppError<C, F> | null {
  return current;
}

function buildFallbackEntry<TCode extends string, TField extends string>(
  action: UIAction,
  config: ServerErrorEngineConfig<TCode, TField>,
): ErrorRegistryEntryFull<TCode> {
  const message = config.fallback?.message ?? "An error occurred";
  switch (action) {
    case "toast":
      return { ui: "toast", message };
    case "modal":
      return { ui: "modal", message };
    case "inline":
      return { ui: "inline", message };
    default:
      return { ui: "silent", message };
  }
}

function resolveHistoryConfig<TCode extends string, TField extends string>(
  config: ServerErrorEngineConfig<TCode, TField>,
): { maxEntries: number } {
  const isProd = process.env["NODE_ENV"] === "production";
  const histConfig = config.history;

  if (histConfig?.enabled === false) return { maxEntries: 0 };

  if (histConfig?.maxEntries !== undefined) {
    const raw = histConfig.maxEntries;
    if (!Number.isInteger(raw) || raw < 0) {
      const fallback = isProd ? 0 : 20;
      if (process.env["NODE_ENV"] !== "production") {
        console.warn(
          `[gracefulerrors/server] Invalid config: "history.maxEntries" must be a non-negative integer (got ${String(raw)}). Using ${fallback}.`,
        );
      }
      return { maxEntries: fallback };
    }
    return { maxEntries: raw };
  }

  const defaultMaxEntries = isProd ? 0 : 20;
  const maxEntries = histConfig?.enabled === true ? 20 : defaultMaxEntries;
  return { maxEntries };
}

// ---------------------------------------------------------------------------
// createServerEngine
// ---------------------------------------------------------------------------

export function createServerEngine<
  TCode extends string = string,
  TField extends string = string,
>(config: ServerErrorEngineConfig<TCode, TField>): ServerErrorEngine<TCode> {
  // ---- Normalizer pipeline ----
  let customNormalizers: Normalizer<TCode, TField>[];
  let resolvedBuiltIn: Normalizer<TCode, TField>;

  if (config.normalizer && config.normalizers) {
    if (process.env["NODE_ENV"] === "development") {
      console.warn(
        "[gracefulerrors/server] Both normalizer and normalizers provided. normalizer takes precedence and normalizers is ignored.",
      );
    }
    customNormalizers = [config.normalizer];
    resolvedBuiltIn = noOpNormalizer;
  } else if (config.normalizer) {
    customNormalizers = [config.normalizer];
    resolvedBuiltIn = noOpNormalizer;
  } else if (config.normalizers) {
    customNormalizers = config.normalizers;
    resolvedBuiltIn = builtInNormalizer as Normalizer<TCode, TField>;
  } else {
    customNormalizers = [];
    resolvedBuiltIn = builtInNormalizer as Normalizer<TCode, TField>;
  }

  // ---- Router ----
  const router = createUIRouter<TCode, TField>();

  // ---- History ----
  const { maxEntries: historyMaxEntries } = resolveHistoryConfig(config);
  const historyEntries: HistoryEntry<TCode>[] = [];

  // ---------------------------------------------------------------------------
  // handle
  // ---------------------------------------------------------------------------

  function handle(raw: unknown): HandleResult<TCode> {
    // Steps 1–3: onError → normalize → onNormalized + async side-effect
    safeCall(config.onError, raw);
    const normalized = runNormalizerPipeline(
      raw,
      customNormalizers,
      resolvedBuiltIn,
      config.onError,
    ) as AppError<TCode, TField>;
    safeCall(config.onNormalized, normalized);

    if (config.onErrorAsync) {
      Promise.resolve(config.onErrorAsync(normalized)).catch((err) => {
        if (process.env["NODE_ENV"] === "development") {
          console.error("[gracefulerrors/server] onErrorAsync rejected:", err);
        }
      });
    }

    // Steps 4–5: transform → suppression check
    const transformResult = safeTransform(config.transform, normalized);
    let current: AppError<TCode, TField>;
    if (transformResult !== null) {
      if (isSuppressionDecision(transformResult)) {
        safeCall(config.onSuppressed, normalized, transformResult.reason);
        const result: HandleResult<TCode> = {
          handled: false,
          reason: "suppressed",
          error: normalized,
        };
        recordHistory(result);
        return result;
      }
      current = transformResult;
    } else {
      current = normalized;
    }

    // Step 6: fingerprint
    const fingerprint = config.fingerprint
      ? config.fingerprint(current)
      : defaultFingerprint(current);

    // Step 7: registry lookup + routing
    const entry = lookupEntry(config.registry, current.code);
    if (!entry && config.requireRegistry) {
      safeCall(config.onFallback, current);
      if (process.env["NODE_ENV"] !== "production") {
        console.error(
          `[gracefulerrors/server] Registry entry required for code: ${String(current.code)}`,
        );
      }
      const result: HandleResult<TCode> = {
        handled: false,
        reason: "suppressed",
        error: current,
      };
      recordHistory(result);
      return result;
    }

    const action = router.route(current, config.registry, {
      fallback: config.fallback,
      requireRegistry: config.requireRegistry,
      allowFallback: config.allowFallback,
      routingStrategy: config.routingStrategy,
      resolvedEntry: entry,
    }) as UIAction;

    // Step 8: routing hooks
    if (!entry && !config.requireRegistry) {
      safeCall(config.onFallback, current);
    }
    safeCall(config.onRouted, current, action);

    // Debug trace
    if (config.debug) {
      const shouldTrace =
        config.debug === true ||
        (typeof config.debug === "object" && config.debug.trace === true);
      if (shouldTrace && process.env["NODE_ENV"] !== "production") {
        console.log("[gracefulerrors/server trace]", {
          raw,
          normalized: current,
          action,
          entry: entry ?? buildFallbackEntry(action, config),
        });
      }
    }

    // Step 9: build result + run reporters
    const result: HandleResult<TCode> = {
      handled: true,
      error: current,
      uiAction: action,
    };
    recordHistory(result);

    if (config.reporters && config.reporters.length > 0) {
      const reporterContext: ReporterContext<TCode> = { result, fingerprint };
      for (const reporter of config.reporters) {
        Promise.resolve(reporter(result.error, reporterContext)).catch(
          (err) => {
            if (process.env["NODE_ENV"] !== "production") {
              console.error("[gracefulerrors/server] reporter threw:", err);
            }
          },
        );
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------

  function recordHistory(result: HandleResult<TCode>): void {
    if (historyMaxEntries <= 0) return;
    const entry: HistoryEntry<TCode> = result.handled
      ? {
          error: result.error,
          handled: true,
          uiAction: result.uiAction,
          handledAt: Date.now(),
        }
      : {
          error: result.error,
          handled: false,
          uiAction: null,
          reason: result.reason,
          handledAt: Date.now(),
        };
    if (historyEntries.length >= historyMaxEntries) {
      historyEntries.shift();
    }
    historyEntries.push(entry);
  }

  function getHistory(): HistoryEntry<TCode>[] {
    return [...historyEntries];
  }

  function clearHistory(): void {
    historyEntries.length = 0;
  }

  return { handle, getHistory, clearHistory };
}

export type {
  ServerErrorEngine,
  ServerErrorEngineConfig,
  HandleResult,
} from "./types";
