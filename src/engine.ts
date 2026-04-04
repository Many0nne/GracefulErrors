import { runNormalizerPipeline, builtInNormalizer } from './normalizer'
import { createStateManager } from './state-manager'
import type { StateManagerConfig } from './state-manager'
import { createUIRouter } from './router'
import { lookupEntry } from './registry'
import type {
  AppError,
  ErrorEngineConfig,
  ErrorEngine,
  HandleResult,
  UIAction,
  RenderIntent,
  ErrorSlot,
  ErrorRegistryEntryFull,
  Normalizer,
  SuppressionDecision,
  TransformResult,
  StateListener,
} from './types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isSuppressionDecision(result: TransformResult): result is SuppressionDecision {
  return (
    result !== null &&
    typeof result === 'object' &&
    'suppress' in result &&
    (result as SuppressionDecision).suppress === true
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeCall(fn: ((...args: any[]) => any) | undefined, ...args: any[]): void {
  if (!fn) return
  try {
    fn(...args)
  } catch (err) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.error('[gracefulerrors] Hook threw:', err)
    }
  }
}

function safeTransform<TCode extends string, TField extends string>(
  fn: ErrorEngineConfig<TCode, TField>['transform'],
  error: AppError<TCode, TField>
): TransformResult<TCode, TField> {
  if (!fn) return null
  try {
    return fn(error, { raw: error.raw })
  } catch (err) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.error('[gracefulerrors] transform threw:', err)
    }
    return null
  }
}

function defaultFingerprint(error: AppError): string {
  return `${error.code}:${error.status ?? ''}:${error.context?.field ?? ''}`
}

function buildFallbackEntry<TCode extends string, TField extends string = string>(
  action: UIAction,
  config: ErrorEngineConfig<TCode, TField>
): ErrorRegistryEntryFull<TCode> {
  return { ui: action as never, message: config.fallback?.message ?? 'An error occurred' }
}

function debugTrace(
  debug: ErrorEngineConfig['debug'],
  trace: Record<string, unknown>
): void {
  const shouldTrace =
    debug === true || (typeof debug === 'object' && debug !== null && debug.trace === true)
  if (shouldTrace && process.env['NODE_ENV'] !== 'production') {
    console.log('[gracefulerrors trace]', trace)
  }
}

function noOpNormalizer<C extends string, F extends string>(_raw: unknown, current: AppError<C, F> | null): AppError<C, F> | null {
  return current
}

// ---------------------------------------------------------------------------
// createErrorEngine
// ---------------------------------------------------------------------------

export function createErrorEngine<TCode extends string = string, TField extends string = string>(
  config: ErrorEngineConfig<TCode, TField>
): ErrorEngine<TCode> {
  // ---- Init: resolve normalizer pipeline ----
  let customNormalizers: Normalizer<TCode, TField>[]
  let resolvedBuiltIn: Normalizer<TCode, TField>

  if (config.normalizer && config.normalizers) {
    if (process.env['NODE_ENV'] === 'development') {
      console.warn(
        '[gracefulerrors] Both normalizer and normalizers provided. normalizer takes precedence and normalizers is ignored.'
      )
    }
    customNormalizers = [config.normalizer]
    resolvedBuiltIn = noOpNormalizer
  } else if (config.normalizer) {
    customNormalizers = [config.normalizer]
    resolvedBuiltIn = noOpNormalizer
  } else if (config.normalizers) {
    customNormalizers = config.normalizers
    resolvedBuiltIn = builtInNormalizer as unknown as Normalizer<TCode, TField>
  } else {
    customNormalizers = []
    resolvedBuiltIn = builtInNormalizer as unknown as Normalizer<TCode, TField>
  }

  // ---- Init: state manager ----
  const stateManager = createStateManager<TCode>({
    maxConcurrent: config.maxConcurrent,
    maxQueue: config.maxQueue,
    dedupeWindow: config.dedupeWindow,
    onDropped: config.onDropped as StateManagerConfig<TCode>['onDropped'],
  })

  // ---- Init: router ----
  const router = createUIRouter<TCode, TField>()

  // ---- Init: aggregation ----
  const aggregationMap = new Map<string, number>()
  const aggregationTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // ---- Init: relay TTL expirations to renderer ----
  stateManager.subscribe((event) => {
    if (event.type === 'ERROR_CLEARED') {
      config.renderer?.clear(event.code as TCode)
    }
  })

  // ---------------------------------------------------------------------------
  // handle
  // ---------------------------------------------------------------------------

  function handle(raw: unknown): HandleResult<TCode> {
    // Step 1: onError — always first, even if normalization will fail
    safeCall(config.onError, raw)

    // Step 2: normalize
    const normalized = runNormalizerPipeline(
      raw,
      customNormalizers,
      resolvedBuiltIn,
      config.onError
    ) as AppError<TCode, TField>

    // Step 3: onNormalized + fire-and-forget async side-effect
    safeCall(config.onNormalized, normalized)

    if (config.onErrorAsync) {
      Promise.resolve(config.onErrorAsync(normalized)).catch((err) => {
        if (process.env['NODE_ENV'] === 'development') {
          console.error('[gracefulerrors] onErrorAsync rejected:', err)
        }
      })
    }

    // Step 4: transform
    const transformResult = safeTransform(config.transform, normalized)

    // Step 5: suppression or apply transform
    let current: AppError<TCode, TField> = normalized

    if (transformResult !== null) {
      if (isSuppressionDecision(transformResult)) {
        safeCall(config.onSuppressed, normalized, transformResult.reason)
        return { handled: false, error: normalized, uiAction: null }
      }
      current = transformResult as AppError<TCode, TField>
    }

    // Step 6: fingerprint
    const fingerprint = config.fingerprint
      ? config.fingerprint(current as AppError<TCode, TField>)
      : defaultFingerprint(current)

    // Step 7: registry lookup + route
    const entry = lookupEntry(config.registry, current.code)

    if (!entry && config.requireRegistry) {
      safeCall(config.onFallback, current)
      if (process.env['NODE_ENV'] !== 'production') {
        console.error(`[gracefulerrors] Registry entry required for code: ${String(current.code)}`)
      }
      return { handled: false, error: current, uiAction: null }
    }

    const routingContext = {
      activeCount: stateManager.getActiveCount(),
      queueLength: stateManager.getQueueLength(),
    }

    const action = router.route(
      current,
      config.registry,
      {
        fallback: config.fallback,
        requireRegistry: config.requireRegistry,
        allowFallback: config.allowFallback,
        routingStrategy: config.routingStrategy,
        routingContext,
        resolvedEntry: entry,
      }
    ) as UIAction

    // Step 8: onFallback (no match, no requireRegistry) + onRouted
    if (!entry && !config.requireRegistry) {
      safeCall(config.onFallback, current)
    }
    safeCall(config.onRouted, current, action)

    // Step 8.5: aggregation check
    const aggConfig = config.aggregation
    if (aggConfig) {
      const aggEnabled =
        aggConfig === true ||
        (typeof aggConfig === 'object' && aggConfig.enabled)
      if (aggEnabled) {
        const aggWindow =
          typeof aggConfig === 'object' && aggConfig.window != null
            ? aggConfig.window
            : 300
        const aggKey = action
        const lastAgg = aggregationMap.get(aggKey)
        const now = Date.now()
        if (lastAgg !== undefined && now - lastAgg < aggWindow) {
          return { handled: false, error: current, uiAction: null }
        }
        aggregationMap.set(aggKey, now)
        const prevTimer = aggregationTimers.get(aggKey)
        if (prevTimer !== undefined) clearTimeout(prevTimer)
        aggregationTimers.set(aggKey, setTimeout(() => {
          aggregationMap.delete(aggKey)
          aggregationTimers.delete(aggKey)
        }, aggWindow))
      }
    }

    const slot: ErrorSlot<TCode> & { ttl?: number; _pendingAction: UIAction } = {
      error: current,
      state: 'ACTIVE' as const,
      fingerprint,
      ttl: entry?.ttl,
      _pendingAction: action,
    }

    const placement = stateManager.enqueue(slot)

    if (placement === 'rejected') {
      return { handled: false, error: current, uiAction: null }
    }

    // Step 10: renderer
    if (config.renderer && action !== 'silent' && action !== 'inline') {
      const intent: RenderIntent<TCode> = {
        ui: action,
        error: current,
        entry: entry ?? buildFallbackEntry(action, config),
      }

      let onDismiss: (() => void) | undefined
      if (action === 'modal') {
        let dismissTimeoutId: ReturnType<typeof setTimeout> | undefined
        if (config.modalDismissTimeoutMs != null && process.env['NODE_ENV'] !== 'production') {
          dismissTimeoutId = setTimeout(() => {
            console.warn(
              `[gracefulerrors] Modal for "${String(current.code)}" was not dismissed within ${config.modalDismissTimeoutMs}ms. Ensure your adapter calls onDismiss().`
            )
          }, config.modalDismissTimeoutMs)
        }
        onDismiss = () => {
          if (dismissTimeoutId !== undefined) clearTimeout(dismissTimeoutId)
          stateManager.release(current.code as TCode)
        }
      }

      config.renderer.render(intent, { onDismiss })
    }

    // Step 11: debug trace
    debugTrace(config.debug, { raw, normalized: current, action, entry, placement })

    // Step 12: return
    return {
      handled: true,
      error: current,
      uiAction: action === 'silent' ? null : action,
    }
  }

  // ---------------------------------------------------------------------------
  // clear / clearAll
  // ---------------------------------------------------------------------------

  function clear(code: TCode): void {
    stateManager.release(code)
    // renderer.clear() is called via subscription on ERROR_CLEARED
  }

  function clearAll(): void {
    stateManager.clearAll()
    for (const timer of aggregationTimers.values()) clearTimeout(timer)
    aggregationTimers.clear()
    aggregationMap.clear()
    config.renderer?.clearAll()
  }

  function subscribe(listener: StateListener<TCode>): () => void {
    return stateManager.subscribe(listener)
  }

  return { handle, clear, clearAll, subscribe }
}

// ---------------------------------------------------------------------------
// createFetch
// ---------------------------------------------------------------------------

export function createFetch(
  engine: ErrorEngine,
  options: { mode?: 'throw' | 'handle' | 'silent' } = {}
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response | undefined> {
  const mode = options.mode ?? 'throw'

  return async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response | undefined> {
    try {
      const response = await fetch(input, init)

      if (!response.ok) {
        if (mode === 'silent') return response
        let errorPayload: unknown = response
        try {
          const body = await response.clone().json()
          if (body != null && typeof body === 'object') {
            errorPayload = { status: response.status, ...(body as object) }
          }
        } catch {
          // body is not JSON — fall back to raw Response
        }
        engine.handle(errorPayload)
        if (mode === 'handle') return undefined
        throw response
      }

      return response
    } catch (error) {
      // AbortError → pass-through, never forwarded to engine
      // DOMException may not extend Error in all environments — check name directly
      if (error != null && (error as Error).name === 'AbortError') throw error

      // Re-thrown Response (4xx/5xx from the !response.ok branch above)
      if (error instanceof Response) throw error

      if (mode === 'silent') throw error

      engine.handle(error)

      if (mode === 'handle') return undefined
      throw error
    }
  }
}

export type { ErrorEngine, ErrorEngineConfig, HandleResult }
