import { createErrorEngine, mergeRegistries, builtInNormalizer } from 'gracefulerrors'
import { createSonnerAdapter } from 'gracefulerrors/sonner'
import type { AppError, ErrorRegistry, Normalizer } from 'gracefulerrors'

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------
export type AppErrorCode =
  // Auth
  | 'AUTH_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_INVALID_CREDENTIALS'
  // Network
  | 'NETWORK_OFFLINE'
  | 'NETWORK_TIMEOUT'
  | 'SERVER_ERROR'
  // Form / Inline
  | 'FORM_EMAIL_INVALID'
  | 'FORM_PASSWORD_TOO_SHORT'
  | 'FORM_REQUIRED'
  // Modal
  | 'DATA_LOSS_WARNING'
  | 'SESSION_EXPIRED_MODAL'
  // Silent
  | 'ANALYTICS_FAIL'
  | 'PREFETCH_FAIL'
  // Dedupe demo
  | 'RATE_LIMITED'
  // Transform demo
  | 'TRANSFORM_DEMO'
  | 'TRANSFORM_SUPPRESS_DEMO'
  // Fetch demo
  | 'HTTP_404'
  | 'HTTP_500'
  // Boundary demo
  | 'RENDER_ERROR'
  // Payment
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_INSUFFICIENT_FUNDS'

// ---------------------------------------------------------------------------
// Registries (split to show mergeRegistries)
// ---------------------------------------------------------------------------

const authRegistry: ErrorRegistry<AppErrorCode> = {
  AUTH_EXPIRED: {
    ui: 'toast',
    message: 'Your session has expired. Please sign in again.',
    ttl: 6000,
    uiOptions: { severity: 'warning', position: 'top-right', duration: 5000, icon: '⏱️' },
  },
  AUTH_FORBIDDEN: {
    ui: 'toast',
    message: 'You do not have permission to perform this action.',
    ttl: 5000,
    uiOptions: { severity: 'error', position: 'top-right', duration: 4000, icon: '🚫' },
  },
  AUTH_INVALID_CREDENTIALS: {
    ui: 'toast',
    message: 'Invalid email or password. Please try again.',
    uiOptions: { severity: 'error', position: 'top-center', duration: 4000 },
  },
}

const networkRegistry: ErrorRegistry<AppErrorCode> = {
  NETWORK_OFFLINE: {
    ui: 'toast',
    message: 'You appear to be offline. Check your connection.',
    ttl: 8000,
    uiOptions: { severity: 'warning', position: 'bottom-center', duration: 6000, icon: '📡' },
  },
  NETWORK_TIMEOUT: {
    ui: 'toast',
    message: 'Request timed out. Please try again.',
    uiOptions: { severity: 'warning', position: 'top-right', duration: 4000, icon: '⌛' },
  },
  SERVER_ERROR: {
    ui: 'toast',
    message: (err: AppError<AppErrorCode>) =>
      `Server error ${err.status ? `(${err.status})` : ''} — our team has been notified.`,
    uiOptions: { severity: 'error', position: 'top-right', duration: 5000 },
  },
}

const formRegistry: ErrorRegistry<AppErrorCode> = {
  FORM_EMAIL_INVALID: {
    ui: 'inline',
    message: 'Please enter a valid email address.',
  },
  FORM_PASSWORD_TOO_SHORT: {
    ui: 'inline',
    message: 'Password must be at least 8 characters.',
  },
  FORM_REQUIRED: {
    ui: 'inline',
    message: 'This field is required.',
  },
}

const modalRegistry: ErrorRegistry<AppErrorCode> = {
  DATA_LOSS_WARNING: {
    ui: 'modal',
    message: 'You have unsaved changes. Are you sure you want to leave? All changes will be lost.',
    uiOptions: { dismissible: true, size: 'md' },
  },
  SESSION_EXPIRED_MODAL: {
    ui: 'modal',
    message: 'Your session has expired. You will be redirected to the login page.',
    uiOptions: { dismissible: false, size: 'sm' },
  },
}

const silentRegistry: ErrorRegistry<AppErrorCode> = {
  ANALYTICS_FAIL: {
    ui: 'silent',
  },
  PREFETCH_FAIL: {
    ui: 'silent',
  },
}

const miscRegistry: ErrorRegistry<AppErrorCode> = {
  RATE_LIMITED: {
    ui: 'toast',
    message: 'Too many requests. Please slow down.',
    ttl: 3000,
    uiOptions: { severity: 'warning', position: 'top-right', duration: 3000, icon: '🛑' },
  },
  TRANSFORM_DEMO: {
    ui: 'toast',
    message: 'Original message (will be replaced by transform)',
    uiOptions: { severity: 'info' },
  },
  TRANSFORM_SUPPRESS_DEMO: {
    ui: 'toast',
    message: 'This should be suppressed',
    uiOptions: { severity: 'error' },
  },
  HTTP_404: {
    ui: 'toast',
    message: 'Resource not found (404).',
    uiOptions: { severity: 'warning', position: 'top-right', duration: 4000 },
  },
  HTTP_500: {
    ui: 'toast',
    message: 'Internal server error (500). Please try again later.',
    uiOptions: { severity: 'error', position: 'top-right', duration: 5000 },
  },
  RENDER_ERROR: {
    ui: 'toast',
    message: 'A component crashed. The error has been caught by the ErrorBoundary.',
    uiOptions: { severity: 'error', position: 'top-right', duration: 6000 },
  },
  PAYMENT_DECLINED: {
    ui: 'modal',
    message: 'Your payment was declined. Please check your card details and try again.',
    uiOptions: { dismissible: true, size: 'md' },
  },
  PAYMENT_INSUFFICIENT_FUNDS: {
    ui: 'modal',
    message: 'Insufficient funds. Please use a different payment method.',
    uiOptions: { dismissible: true, size: 'sm' },
  },
}

// Merge all registries to show mergeRegistries utility
const fullRegistry = mergeRegistries(
  mergeRegistries(
    mergeRegistries(authRegistry, networkRegistry),
    mergeRegistries(formRegistry, modalRegistry)
  ),
  mergeRegistries(silentRegistry, miscRegistry)
)

// ---------------------------------------------------------------------------
// Custom normalizer — recognises our demo API shape { errorCode, statusCode, detail }
// ---------------------------------------------------------------------------
const demoApiNormalizer: Normalizer<AppErrorCode> = (raw, current) => {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'errorCode' in (raw as object)
  ) {
    const r = raw as { errorCode: string; statusCode?: number; detail?: string; field?: string }
    return {
      code: r.errorCode as AppErrorCode,
      status: r.statusCode,
      message: r.detail,
      context: r.field ? { field: r.field } : undefined,
      raw,
    }
  }
  return current
}

// ---------------------------------------------------------------------------
// Lifecycle log — shared mutable array, subscribers push events here
// ---------------------------------------------------------------------------
export type LogEntry = {
  id: number
  timestamp: string
  type: string
  code?: string
  action?: string
  reason?: string
  detail?: string
}

let _logCounter = 0
export const lifecycleLogs: LogEntry[] = []
export const logSubscribers: Array<(logs: LogEntry[]) => void> = []

function pushLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
  const log: LogEntry = {
    id: ++_logCounter,
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    ...entry,
  }
  lifecycleLogs.unshift(log)
  if (lifecycleLogs.length > 50) lifecycleLogs.pop()
  logSubscribers.forEach(fn => fn([...lifecycleLogs]))
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
export const sonnerAdapter = createSonnerAdapter()

export const engine = createErrorEngine<AppErrorCode>({
  registry: fullRegistry,

  normalizers: [demoApiNormalizer, builtInNormalizer as Normalizer<AppErrorCode>],

  fallback: {
    ui: 'toast',
    message: 'An unexpected error occurred.',
  },

  dedupeWindow: 800,
  maxConcurrent: 4,
  maxQueue: 10,

  debug: { trace: true },

  transform: (error) => {
    // Demonstrate transform: re-label TRANSFORM_DEMO with a new message
    if (error.code === 'TRANSFORM_DEMO') {
      return { ...error, message: '[Transformed] This message was rewritten by transform()' }
    }
    // Demonstrate suppression
    if (error.code === 'TRANSFORM_SUPPRESS_DEMO') {
      return { suppress: true, reason: 'Demo suppression: code TRANSFORM_SUPPRESS_DEMO is suppressed' }
    }
    return null
  },

  onError: (raw) => {
    pushLog({ type: 'onError', detail: typeof raw === 'object' && raw !== null ? JSON.stringify(raw).slice(0, 80) : String(raw) })
  },

  onNormalized: (error) => {
    pushLog({ type: 'onNormalized', code: error.code, detail: error.message?.slice(0, 60) })
  },

  onRouted: (error, action) => {
    pushLog({ type: 'onRouted', code: error.code, action })
  },

  onSuppressed: (error, reason) => {
    pushLog({ type: 'onSuppressed', code: error.code, reason: reason.slice(0, 60) })
  },

  onFallback: (error) => {
    pushLog({ type: 'onFallback', code: error.code, detail: 'No registry entry — using fallback' })
  },

  onDropped: (error, reason) => {
    pushLog({ type: 'onDropped', code: error.code, reason })
  },

  renderer: sonnerAdapter,
})

// Subscribe engine to lifecycle log for state events
engine.subscribe((event) => {
  if (event.type === 'ERROR_ADDED') {
    pushLog({ type: 'ERROR_ADDED', code: event.error.code, action: event.action })
  } else if (event.type === 'ERROR_CLEARED') {
    pushLog({ type: 'ERROR_CLEARED', code: event.code })
  } else if (event.type === 'ALL_CLEARED') {
    pushLog({ type: 'ALL_CLEARED' })
  }
})
