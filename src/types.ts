// Reserved system codes - produced internally when normalization fails
export type SystemErrorCode = 'GRACEFULERRORS_UNKNOWN' | 'GRACEFULERRORS_UNHANDLED'

// Structured matching key used by routing, registry lookup, dedupe, and debug traces.
export interface ErrorKey<TCode extends string = string, TField extends string = string> {
  code: TCode
  status?: number
  field?: TField
}

// Normalized error â€” the engine's internal contract
export interface AppError<TCode extends string = string, TField extends string = string> {
  code: TCode | SystemErrorCode
  status?: number
  message?: string
  context?: {
    field?: TField
    [key: string]: unknown
  }
  raw?: unknown
}

export type SuppressionDecision = {
  suppress: true
  reason: string
}

export type TransformResult<TCode extends string = string, TField extends string = string> =
  | AppError<TCode, TField>
  | SuppressionDecision
  | null

export type TransformContext = {
  raw: unknown
}

// UI options â€” typed per ui value via discriminated union
export type UIOptions =
  | {
      ui: 'toast'
      uiOptions?: {
        position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
        severity?: 'info' | 'warning' | 'error' | 'success'
        icon?: string
        duration?: number
      }
    }
  | { ui: 'modal'; uiOptions?: { dismissible?: boolean; size?: 'sm' | 'md' | 'lg' } }
  | { ui: 'inline'; uiOptions?: Record<string, unknown> }
  | { ui: 'silent'; uiOptions?: never }

export type UIAction = 'toast' | 'modal' | 'inline' | 'silent'

// Registry types
export type ErrorRegistryEntry<TCode extends string = string> = {
  message?: string | ((error: AppError<TCode>) => string)
  ttl?: number
} & UIOptions

// Semantic alias â€” structurally identical to ErrorRegistryEntry, may diverge in V1
export type ErrorRegistryEntryFull<TCode extends string = string> = ErrorRegistryEntry<TCode>

export type ErrorRegistry<TCode extends string = string> = {
  [K in TCode]?: ErrorRegistryEntry<TCode>
}

// Render types
export type RenderIntent<TCode extends string = string> = {
  ui: UIAction
  error: AppError<TCode>
  entry: ErrorRegistryEntryFull<TCode>
}

export interface RendererAdapter {
  render<TCode extends string = string>(intent: RenderIntent<TCode>, lifecycle: { onDismiss?: () => void }): void
  clear(code: string): void
  clearAll(): void
}

// Engine public interface types
export interface ErrorEngine<TCode extends string = string> {
  handle(raw: unknown): HandleResult<TCode>
  clear(code: TCode): void
  clearAll(): void
  subscribe(listener: StateListener<TCode>): () => void
}

export interface HandleResult<TCode extends string = string> {
  // true if the error reached routing (even if routed to 'silent')
  // false if suppressed via transform or dropped (dedupe / queue overflow)
  handled: boolean
  error: AppError<TCode>
  // null when handled is false, or when explicitly routed to 'silent'
  uiAction: UIAction | null
}

export type RoutingStrategy<TCode extends string = string, TField extends string = string> = (
  error: AppError<TCode, TField>,
  registryEntry: ErrorRegistryEntryFull<TCode> | undefined,
  context: { activeCount: number; queueLength: number }
) => UIAction | null

// State machine types
export type ErrorState = 'ACTIVE' | 'QUEUED' | 'EXPIRED' | 'DROPPED'

export interface ErrorSlot<TCode extends string = string> {
  error: AppError<TCode>
  state: ErrorState
  fingerprint: string
  expiresAt?: number  // ms timestamp, only while ACTIVE when TTL is enabled
}

// @internal â€” exported via gracefulerrors/internal for tests only
export type StateListener<TCode extends string = string> = (
  event:
    | { type: 'ERROR_ADDED'; error: AppError<TCode>; action: UIAction }
    | { type: 'ERROR_CLEARED'; code: TCode }
    | { type: 'ALL_CLEARED' }
) => void

// @internal â€” exported via gracefulerrors/internal for tests only
export interface ErrorStateManager<TCode extends string = string> {
  canHandle(fingerprint: string): boolean
  enqueue(slot: ErrorSlot<TCode> & { _pendingAction?: UIAction; ttl?: number }): 'active' | 'queued' | 'rejected'
  release(code: TCode): void
  getActiveSlots(): ErrorSlot<TCode>[]
  getQueueLength(): number
  clearAll(): void
  subscribe(listener: StateListener<TCode>): () => void
}

// @internal â€” exported via gracefulerrors/internal for tests only
export interface UIRouter<TCode extends string = string, TField extends string = string> {
  route(
    error: AppError<TCode, TField>,
    registry: ErrorRegistry<TCode>,
    config: Pick<ErrorEngineConfig<TCode, TField>, 'fallback' | 'requireRegistry' | 'allowFallback' | 'routingStrategy'> & {
      routingContext?: { activeCount: number; queueLength: number }
    }
  ): UIAction | null
}

// Normalizer type
export type Normalizer<TCode extends string = string, TField extends string = string> = (
  raw: unknown,
  current: AppError<TCode, TField> | null
) => AppError<TCode, TField> | null

// Engine config type
export interface ErrorEngineConfig<TCode extends string = string, TField extends string = string> {
  registry: ErrorRegistry<TCode>
  requireRegistry?: boolean
  // Default: true. When false, configured fallback is ignored and engine uses 'toast' as hard default.
  allowFallback?: boolean
  // 'inline' intentionally excluded â€” inline errors require context.field to be meaningful.
  fallback?: {
    ui: 'toast' | 'modal' | 'silent'
    message?: string
  }
  normalizers?: Normalizer<TCode, TField>[]
  // If both normalizer and normalizers are provided, normalizer takes precedence and normalizers is ignored.
  // A warning is emitted in development.
  normalizer?: Normalizer<TCode, TField>
  fingerprint?: (error: AppError<TCode, TField>) => string
  dedupeWindow?: number       // ms, default: 300
  maxConcurrent?: number      // default: 3
  maxQueue?: number           // default: unbounded
  aggregation?: boolean | { enabled: boolean; window?: number }
  routingStrategy?: RoutingStrategy<TCode, TField>
  transform?: (error: AppError<TCode, TField>, context: TransformContext) => TransformResult<TCode, TField>
  onError?: (raw: unknown) => void
  onNormalized?: (error: AppError<TCode, TField>) => void
  onSuppressed?: (error: AppError<TCode, TField>, reason: string) => void
  onRouted?: (error: AppError<TCode, TField>, action: UIAction) => void
  onFallback?: (error: AppError<TCode, TField>) => void
  onErrorAsync?: (error: AppError<TCode, TField>) => Promise<void>
  onDropped?: (error: AppError<TCode, TField>, reason: 'dedupe' | 'ttl_expired' | 'queue_overflow') => void
  debug?: boolean | { trace?: boolean }
  modalDismissTimeoutMs?: number
  renderer?: RendererAdapter
}
