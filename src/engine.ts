import { runNormalizerPipeline, builtInNormalizer } from "./normalizer";
import { createStateManager } from "./state-manager";
import type { StateManagerConfig } from "./state-manager";
import { createUIRouter } from "./router";
import { lookupEntry } from "./registry";
import type {
  AppError,
  ErrorEngineConfig,
  ErrorEngine,
  HandleResult,
  HistoryEntry,
  UIAction,
  RenderIntent,
  ErrorSlot,
  ErrorRegistryEntryFull,
  Normalizer,
  ReporterContext,
  SuppressionDecision,
  TransformResult,
  StateListener,
} from "./types";

// ---------------------------------------------------------------------------
// Internal helpers
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
      console.error("[gracefulerrors] Hook threw:", err);
    }
  }
}

function safeTransform<TCode extends string, TField extends string>(
  fn: ErrorEngineConfig<TCode, TField>["transform"],
  error: AppError<TCode, TField>,
): TransformResult<TCode, TField> {
  if (!fn) return null;
  try {
    return fn(error, { raw: error.raw });
  } catch (err) {
    if (process.env["NODE_ENV"] !== "production") {
      console.error("[gracefulerrors] transform threw:", err);
    }
    return null;
  }
}

function defaultFingerprint(error: AppError): string {
  return `${error.code}:${error.status ?? ""}:${error.context?.field ?? ""}`;
}

function buildFallbackEntry<
  TCode extends string,
  TField extends string = string,
>(
  action: UIAction,
  config: ErrorEngineConfig<TCode, TField>,
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

function debugTrace(
  debug: ErrorEngineConfig["debug"],
  trace: Record<string, unknown>,
): void {
  const shouldTrace =
    debug === true ||
    (typeof debug === "object" && debug !== null && debug.trace === true);
  if (shouldTrace && process.env["NODE_ENV"] !== "production") {
    console.log("[gracefulerrors trace]", trace);
  }
}

function noOpNormalizer<C extends string, F extends string>(
  _raw: unknown,
  current: AppError<C, F> | null,
): AppError<C, F> | null {
  return current;
}

// ---------------------------------------------------------------------------
// Config validation
// ---------------------------------------------------------------------------

function warnInvalidConfig(
  field: string,
  value: unknown,
  expected: string,
  fallback: unknown,
): void {
  if (process.env["NODE_ENV"] !== "production") {
    console.warn(
      `[gracefulerrors] Invalid config: "${field}" must be ${expected} (got ${String(value)}). Using ${String(fallback)}.`,
    );
  }
}

function sanitizeNumeric(
  value: number | undefined,
  field: string,
  isValid: (v: number) => boolean,
  expected: string,
  fallback: number | undefined,
): number | undefined {
  if (value === undefined || isValid(value)) return value;
  warnInvalidConfig(field, value, expected, fallback ?? "undefined (disabled)");
  return fallback;
}

function resolveAggWindow<TCode extends string, TField extends string>(
  config: ErrorEngineConfig<TCode, TField>,
): number {
  const DEFAULT = 300;
  if (typeof config.aggregation !== "object" || config.aggregation === null) {
    return DEFAULT;
  }
  const rawWindow = config.aggregation.window;
  if (rawWindow === undefined) return DEFAULT;
  if (!Number.isFinite(rawWindow) || rawWindow < 0) {
    warnInvalidConfig(
      "aggregation.window",
      rawWindow,
      "a non-negative number",
      DEFAULT,
    );
    return DEFAULT;
  }
  return rawWindow;
}

function validateRegistryTtls<TCode extends string, TField extends string>(
  registry: ErrorEngineConfig<TCode, TField>["registry"],
): void {
  for (const [code, entry] of Object.entries(registry)) {
    const ttl = (entry as { ttl?: number } | null)?.ttl;
    if (ttl !== undefined && (!Number.isFinite(ttl) || ttl < 0)) {
      warnInvalidConfig(
        `registry["${code}"].ttl`,
        ttl,
        "a non-negative number",
        "ignored",
      );
    }
  }
}

function validateNumericConfig<TCode extends string, TField extends string>(
  config: ErrorEngineConfig<TCode, TField>,
): {
  maxConcurrent: number | undefined;
  maxQueue: number | undefined;
  dedupeWindow: number | undefined;
  aggWindow: number;
  modalDismissTimeoutMs: number | undefined;
} {
  validateRegistryTtls(config.registry);

  return {
    maxConcurrent: sanitizeNumeric(
      config.maxConcurrent,
      "maxConcurrent",
      (v) => Number.isInteger(v) && v > 0,
      "a positive integer",
      3,
    ),
    maxQueue: sanitizeNumeric(
      config.maxQueue,
      "maxQueue",
      (v) => Number.isInteger(v) && v >= 0,
      "a non-negative integer",
      25,
    ),
    dedupeWindow: sanitizeNumeric(
      config.dedupeWindow,
      "dedupeWindow",
      (v) => Number.isFinite(v) && v >= 0,
      "a non-negative number",
      300,
    ),
    aggWindow: resolveAggWindow(config),
    modalDismissTimeoutMs: sanitizeNumeric(
      config.modalDismissTimeoutMs,
      "modalDismissTimeoutMs",
      (v) => Number.isFinite(v) && v > 0,
      "a positive number",
      undefined,
    ),
  };
}

// ---------------------------------------------------------------------------
// History config resolution
// ---------------------------------------------------------------------------

function resolveHistoryConfig<TCode extends string, TField extends string>(
  config: ErrorEngineConfig<TCode, TField>,
): { maxEntries: number } {
  const isProd = process.env["NODE_ENV"] === "production";
  const histConfig = config.history;

  if (histConfig?.enabled === false) return { maxEntries: 0 };

  if (histConfig?.maxEntries !== undefined) {
    const raw = histConfig.maxEntries;
    if (!Number.isInteger(raw) || raw < 0) {
      const fallback = isProd ? 0 : 20;
      warnInvalidConfig(
        "history.maxEntries",
        raw,
        "a non-negative integer",
        fallback,
      );
      return { maxEntries: fallback };
    }
    return { maxEntries: raw };
  }

  // No maxEntries given: explicit enabled:true overrides production default
  const defaultMaxEntries = isProd ? 0 : 20;
  const maxEntries = histConfig?.enabled === true ? 20 : defaultMaxEntries;
  return { maxEntries };
}

// ---------------------------------------------------------------------------
// createErrorEngine
// ---------------------------------------------------------------------------

/**
 * Creates a GracefulErrors engine — the central hub that normalizes, routes,
 * deduplicates, and renders errors through a configurable pipeline.
 *
 * The pipeline follows numbered steps 1–12 internally:
 * 1. `onError` hook
 * 2. Normalizer pipeline (custom → built-in)
 * 3. `onNormalized` hook + `onErrorAsync` side-effect
 * 4. `transform` function (optional mutation or suppression)
 * 5. Suppression check
 * 6. Fingerprint computation
 * 7. Registry lookup + routing (early-exit when `requireRegistry` and no entry)
 * 8. `onFallback` / `onRouted` lifecycle hooks
 * 8.5. Aggregation window check
 * 9. State manager enqueue (dedup / queue overflow guard)
 * 10. Renderer invocation
 * 11. Debug trace
 * 12. Return `HandleResult`
 *
 * @param config - Engine configuration. See `ErrorEngineConfig` for all options.
 * @returns An `ErrorEngine` instance with `handle`, `clear`, `clearAll`,
 *   `subscribe`, `destroy`, `getHistory`, and `clearHistory` methods.
 *
 * @example
 * ```ts
 * const engine = createErrorEngine({
 *   registry: {
 *     AUTH_FAILED: { ui: 'toast', message: 'Session expired. Please log in.' },
 *   },
 * });
 * engine.handle(error);
 * ```
 */
export function createErrorEngine<
  TCode extends string = string,
  TField extends string = string,
>(config: ErrorEngineConfig<TCode, TField>): ErrorEngine<TCode> {
  // ---- Init: validate numeric config ----
  const {
    maxConcurrent: resolvedMaxConcurrent,
    maxQueue: resolvedMaxQueue,
    dedupeWindow: resolvedDedupeWindow,
    aggWindow: resolvedAggWindow,
    modalDismissTimeoutMs: resolvedModalDismissTimeoutMs,
  } = validateNumericConfig(config);

  // ---- Init: resolve normalizer pipeline ----
  let customNormalizers: Normalizer<TCode, TField>[];
  let resolvedBuiltIn: Normalizer<TCode, TField>;

  if (config.normalizer && config.normalizers) {
    if (process.env["NODE_ENV"] === "development") {
      console.warn(
        "[gracefulerrors] Both normalizer and normalizers provided. normalizer takes precedence and normalizers is ignored.",
      );
    }
    customNormalizers = [config.normalizer];
    resolvedBuiltIn = noOpNormalizer;
  } else if (config.normalizer) {
    customNormalizers = [config.normalizer];
    resolvedBuiltIn = noOpNormalizer;
  } else if (config.normalizers) {
    customNormalizers = config.normalizers;
    // builtInNormalizer returns AppError with open-ended string codes (e.g. 'HTTP_404',
    // 'GRACEFULERRORS_UNKNOWN') that are not constrained to TCode. The cast is safe because
    // the normalizer pipeline accepts any string code; TCode is only enforced at the API boundary.
    resolvedBuiltIn = builtInNormalizer as Normalizer<TCode, TField>;
  } else {
    customNormalizers = [];
    // builtInNormalizer returns AppError with open-ended string codes (e.g. 'HTTP_404',
    // 'GRACEFULERRORS_UNKNOWN') that are not constrained to TCode. The cast is safe because
    // the normalizer pipeline accepts any string code; TCode is only enforced at the API boundary.
    resolvedBuiltIn = builtInNormalizer as Normalizer<TCode, TField>;
  }

  // ---- Init: state manager ----
  const stateManager = createStateManager<TCode>({
    maxConcurrent: resolvedMaxConcurrent,
    maxQueue: resolvedMaxQueue,
    dedupeWindow: resolvedDedupeWindow,
    // StateManager only tracks TCode, not TField; ErrorSlot<TCode> stores AppError<TCode, string>.
    // The cast is safe at runtime because TField only affects the TypeScript type of context.field,
    // not the runtime value. Eliminating it would require threading TField through ErrorSlot/StateManager.
    onDropped: config.onDropped as StateManagerConfig<TCode>["onDropped"],
  });

  // ---- Init: router ----
  const router = createUIRouter<TCode, TField>();

  // ---- Init: history ----
  const { maxEntries: historyMaxEntries } = resolveHistoryConfig(config);
  const historyEntries: HistoryEntry<TCode>[] = [];

  // ---- Init: aggregation ----
  const aggregationMap = new Map<string, number>();
  const aggregationTimers = new Map<string, ReturnType<typeof setTimeout>>();

  // ---- Init: relay TTL expirations to renderer ----
  stateManager.subscribe((event) => {
    if (event.type === "ERROR_CLEARED") {
      config.renderer?.clear(event.code as TCode);
    }
  });

  // ---------------------------------------------------------------------------
  // handle — step helpers (closures over engine state)
  // ---------------------------------------------------------------------------

  // Steps 1–3: onError → normalize → onNormalized + async side-effect
  function runNormalizationStep(raw: unknown): AppError<TCode, TField> {
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
          console.error("[gracefulerrors] onErrorAsync rejected:", err);
        }
      });
    }
    return normalized;
  }

  // Steps 4–5: transform → suppression check
  type TransformStep =
    | { suppressed: true; result: HandleResult<TCode> }
    | { suppressed: false; current: AppError<TCode, TField> };

  function runTransformAndSuppress(
    normalized: AppError<TCode, TField>,
  ): TransformStep {
    const transformResult = safeTransform(config.transform, normalized);
    if (transformResult !== null) {
      if (isSuppressionDecision(transformResult)) {
        safeCall(config.onSuppressed, normalized, transformResult.reason);
        return {
          suppressed: true,
          result: { handled: false, reason: "suppressed", error: normalized },
        };
      }
      return { suppressed: false, current: transformResult };
    }
    return { suppressed: false, current: normalized };
  }

  // Step 6: compute fingerprint
  function runFingerprintStep(current: AppError<TCode, TField>): string {
    return config.fingerprint
      ? config.fingerprint(current)
      : defaultFingerprint(current);
  }

  // Step 7: registry lookup → route (early-exit when requireRegistry and no entry)
  type RoutingStep =
    | { suppressed: true; result: HandleResult<TCode> }
    | {
        suppressed: false;
        entry: ErrorRegistryEntryFull<TCode> | undefined;
        action: UIAction;
      };

  function runRoutingStep(current: AppError<TCode, TField>): RoutingStep {
    const entry = lookupEntry(config.registry, current.code);
    if (!entry && config.requireRegistry) {
      safeCall(config.onFallback, current);
      if (process.env["NODE_ENV"] !== "production") {
        console.error(
          `[gracefulerrors] Registry entry required for code: ${String(current.code)}`,
        );
      }
      return {
        suppressed: true,
        result: { handled: false, reason: "suppressed", error: current },
      };
    }
    const routingContext = {
      activeCount: stateManager.getActiveCount(),
      queueLength: stateManager.getQueueLength(),
    };
    const action = router.route(current, config.registry, {
      fallback: config.fallback,
      requireRegistry: config.requireRegistry,
      allowFallback: config.allowFallback,
      routingStrategy: config.routingStrategy,
      routingContext,
      resolvedEntry: entry,
    }) as UIAction;
    return { suppressed: false, entry, action };
  }

  // Step 8: routing lifecycle hooks (onFallback when unmatched, onRouted)
  function runRoutingHooks(
    current: AppError<TCode, TField>,
    entry: ErrorRegistryEntryFull<TCode> | undefined,
    action: UIAction,
  ): void {
    if (!entry && !config.requireRegistry) {
      safeCall(config.onFallback, current);
    }
    safeCall(config.onRouted, current, action);
  }

  // Step 8.5: aggregation window — suppresses duplicate action within window
  function runAggregationCheck(
    current: AppError<TCode, TField>,
    action: UIAction,
  ): HandleResult<TCode> | null {
    const aggConfig = config.aggregation;
    if (!aggConfig) return null;
    const aggEnabled =
      aggConfig === true ||
      (typeof aggConfig === "object" && aggConfig.enabled);
    if (!aggEnabled) return null;
    const aggKey = action;
    const lastAgg = aggregationMap.get(aggKey);
    const now = Date.now();
    if (lastAgg !== undefined && now - lastAgg < resolvedAggWindow) {
      return { handled: false, reason: "suppressed", error: current };
    }
    aggregationMap.set(aggKey, now);
    const prevTimer = aggregationTimers.get(aggKey);
    if (prevTimer !== undefined) clearTimeout(prevTimer);
    aggregationTimers.set(
      aggKey,
      setTimeout(() => {
        aggregationMap.delete(aggKey);
        aggregationTimers.delete(aggKey);
      }, resolvedAggWindow),
    );
    return null;
  }

  // Steps 9–10: enqueue into state manager → invoke renderer
  function runStateAndRender(
    current: AppError<TCode, TField>,
    action: UIAction,
    entry: ErrorRegistryEntryFull<TCode> | undefined,
    fingerprint: string,
  ): HandleResult<TCode> | null {
    const slot: ErrorSlot<TCode> & { ttl?: number; _pendingAction: UIAction } =
      {
        error: current,
        state: "ACTIVE" as const,
        fingerprint,
        ttl: entry?.ttl,
        _pendingAction: action,
      };
    const placement = stateManager.enqueue(slot);
    if (placement === "deduped" || placement === "dropped") {
      return { handled: false, reason: placement, error: current };
    }
    if (config.renderer && action !== "silent" && action !== "inline") {
      const intent: RenderIntent<TCode> = {
        ui: action,
        error: current,
        entry: entry ?? buildFallbackEntry(action, config),
        messageResolver: config.messageResolver,
      };
      let onDismiss: (() => void) | undefined;
      if (action === "modal") {
        let dismissTimeoutId: ReturnType<typeof setTimeout> | undefined;
        if (
          resolvedModalDismissTimeoutMs != null &&
          process.env["NODE_ENV"] !== "production"
        ) {
          dismissTimeoutId = setTimeout(() => {
            console.warn(
              `[gracefulerrors] Modal for "${String(current.code)}" was not dismissed within ${resolvedModalDismissTimeoutMs}ms. Ensure your adapter calls onDismiss().`,
            );
          }, resolvedModalDismissTimeoutMs);
        }
        onDismiss = () => {
          if (dismissTimeoutId !== undefined) clearTimeout(dismissTimeoutId);
          stateManager.release(current.code as TCode);
        };
      }
      config.renderer.render(intent, { onDismiss });
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // handle
  // ---------------------------------------------------------------------------

  function handleCore(raw: unknown): {
    result: HandleResult<TCode>;
    fingerprint: string;
  } {
    const normalized = runNormalizationStep(raw);

    const transformStep = runTransformAndSuppress(normalized);
    // Compute fingerprint on the best available error (normalized when suppressed early)
    const current = transformStep.suppressed
      ? normalized
      : transformStep.current;
    const fingerprint = runFingerprintStep(current);

    if (transformStep.suppressed) {
      return { result: transformStep.result, fingerprint };
    }

    const routingStep = runRoutingStep(current);
    if (routingStep.suppressed) {
      return { result: routingStep.result, fingerprint };
    }
    const { entry, action } = routingStep;

    runRoutingHooks(current, entry, action);

    const aggResult = runAggregationCheck(current, action);
    if (aggResult !== null) return { result: aggResult, fingerprint };

    const stateResult = runStateAndRender(current, action, entry, fingerprint);
    if (stateResult !== null) return { result: stateResult, fingerprint };

    // Steps 11–12: debug trace + return
    debugTrace(config.debug, {
      raw,
      normalized: current,
      action,
      entry,
      placement: "active",
    });

    return {
      result: { handled: true, error: current, uiAction: action },
      fingerprint,
    };
  }

  function handle(raw: unknown): HandleResult<TCode> {
    const { result, fingerprint } = handleCore(raw);

    if (historyMaxEntries > 0) {
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

    if (config.reporters && config.reporters.length > 0) {
      const reporterContext: ReporterContext<TCode> = { result, fingerprint };
      for (const reporter of config.reporters) {
        Promise.resolve(reporter(result.error, reporterContext)).catch(
          (err) => {
            if (process.env["NODE_ENV"] !== "production") {
              console.error("[gracefulerrors] reporter threw:", err);
            }
          },
        );
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // clear / clearAll
  // ---------------------------------------------------------------------------

  function clear(code: TCode): void {
    stateManager.release(code);
    // renderer.clear() is called via subscription on ERROR_CLEARED
  }

  function clearAll(): void {
    stateManager.clearAll();
    for (const timer of aggregationTimers.values()) clearTimeout(timer);
    aggregationTimers.clear();
    aggregationMap.clear();
    config.renderer?.clearAll();
  }

  function subscribe(listener: StateListener<TCode>): () => void {
    return stateManager.subscribe(listener);
  }

  function destroy(): void {
    for (const timer of aggregationTimers.values()) clearTimeout(timer);
    aggregationTimers.clear();
    aggregationMap.clear();
    stateManager.destroy();
  }

  function getHistory(): HistoryEntry<TCode>[] {
    return [...historyEntries];
  }

  function clearHistory(): void {
    historyEntries.length = 0;
  }

  return {
    handle,
    clear,
    clearAll,
    subscribe,
    destroy,
    getHistory,
    clearHistory,
  };
}

// ---------------------------------------------------------------------------
// createFetch
// ---------------------------------------------------------------------------

/**
 * Wraps the native `fetch` API and forwards non-OK responses and network errors
 * to a GracefulErrors engine.
 *
 * Modes:
 * - `throw`  (default) — forward to engine, then re-throw so calling code can react
 * - `handle`           — forward to engine, then swallow (resolves `undefined`)
 * - `silent`           — pass-through without notifying the engine
 *
 * `AbortError` is always re-thrown without being forwarded to the engine, regardless
 * of mode — cancellations are not errors.
 *
 * @param engine - A GracefulErrors engine instance created with `createErrorEngine`.
 * @param options - Optional mode override. Defaults to `{ mode: 'throw' }`.
 * @returns A drop-in replacement for `fetch` with the same signature.
 *
 * @example
 * ```ts
 * const safeFetch = createFetch(engine);
 * const data = await safeFetch('/api/users').then(r => r?.json());
 * ```
 */
export function createFetch(
  engine: ErrorEngine,
  options: { mode?: "throw" | "handle" | "silent" } = {},
): (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response | undefined> {
  const mode = options.mode ?? "throw";

  return async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response | undefined> {
    try {
      const response = await fetch(input, init);

      if (!response.ok) {
        if (mode === "silent") return response;
        let errorPayload: unknown = response;
        try {
          const body = await response.clone().json();
          if (body != null && typeof body === "object") {
            errorPayload = { status: response.status, ...(body as object) };
          }
        } catch {
          // body is not JSON — fall back to raw Response
        }
        engine.handle(errorPayload);
        if (mode === "handle") return undefined;
        throw response;
      }

      return response;
    } catch (error) {
      // AbortError → pass-through, never forwarded to engine
      // DOMException may not extend Error in all environments — check name directly
      if (error != null && (error as Error).name === "AbortError") throw error;

      // Re-thrown Response (4xx/5xx from the !response.ok branch above)
      if (error instanceof Response) throw error;

      if (mode === "silent") throw error;

      engine.handle(error);

      if (mode === "handle") return undefined;
      throw error;
    }
  };
}

export type { ErrorEngine, ErrorEngineConfig, HandleResult } from "./types";
