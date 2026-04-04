import { createErrorEngine, mergeRegistries, builtInNormalizer } from 'gracefulerrors'
import type { ErrorRegistry, AppError } from 'gracefulerrors'
import { reactive } from 'vue'
import { createVueRenderer } from './renderer'

// ── Registry ────────────────────────────────────────────────────────────────

const authRegistry: ErrorRegistry<
  'AUTH_EXPIRED' | 'AUTH_FORBIDDEN' | 'AUTH_INVALID_CREDENTIALS' | 'AUTH_MFA_REQUIRED'
> = {
  AUTH_EXPIRED: {
    ui: 'toast',
    message: 'Your session has expired. Please sign in again.',
    ttl: 5000,
    uiOptions: { severity: 'warning', position: 'top-right' },
  },
  AUTH_FORBIDDEN: {
    ui: 'modal',
    message: 'You do not have permission to perform this action.',
    uiOptions: { dismissible: true, size: 'sm' },
  },
  AUTH_INVALID_CREDENTIALS: {
    ui: 'inline',
    message: 'Invalid email or password.',
  },
  AUTH_MFA_REQUIRED: {
    ui: 'toast',
    message: 'Two-factor authentication required.',
    ttl: 6000,
    uiOptions: { severity: 'info', position: 'top-center' },
  },
}

const networkRegistry: ErrorRegistry<
  | 'NETWORK_OFFLINE'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_RATE_LIMITED'
  | 'NETWORK_SERVER_ERROR'
  | 'NETWORK_NOT_FOUND'
  | 'NETWORK_BAD_REQUEST'
> = {
  NETWORK_OFFLINE: {
    ui: 'modal',
    message: 'No internet connection. Check your network and try again.',
    uiOptions: { dismissible: false, size: 'sm' },
  },
  NETWORK_TIMEOUT: {
    ui: 'toast',
    message: 'Request timed out. Please try again.',
    ttl: 4000,
    uiOptions: { severity: 'warning' },
  },
  NETWORK_RATE_LIMITED: {
    ui: 'toast',
    message: (err: AppError) =>
      `Rate limit hit${err.context?.retryAfter ? ` — retry in ${err.context.retryAfter}s` : ''}. Slow down!`,
    ttl: 5000,
    uiOptions: { severity: 'warning', position: 'bottom-right' },
  },
  NETWORK_SERVER_ERROR: {
    ui: 'toast',
    message: 'Internal server error. Our team has been notified.',
    ttl: 6000,
    uiOptions: { severity: 'error' },
  },
  NETWORK_NOT_FOUND: {
    ui: 'toast',
    message: 'Resource not found (404).',
    ttl: 3500,
    uiOptions: { severity: 'error' },
  },
  NETWORK_BAD_REQUEST: {
    ui: 'toast',
    message: 'Bad request — check your input and try again.',
    ttl: 4000,
    uiOptions: { severity: 'warning' },
  },
}

const formRegistry: ErrorRegistry<
  'FORM_VALIDATION_EMAIL' | 'FORM_VALIDATION_REQUIRED' | 'FORM_VALIDATION_MIN_LENGTH' | 'FORM_SUBMIT_FAILED'
> = {
  FORM_VALIDATION_EMAIL: {
    ui: 'inline',
    message: 'Please enter a valid email address.',
  },
  FORM_VALIDATION_REQUIRED: {
    ui: 'inline',
    message: (err: AppError) =>
      `${err.context?.field ? `"${String(err.context.field)}"` : 'This field'} is required.`,
  },
  FORM_VALIDATION_MIN_LENGTH: {
    ui: 'inline',
    message: (err: AppError) =>
      `Minimum ${String(err.context?.min ?? 8)} characters required.`,
  },
  FORM_SUBMIT_FAILED: {
    ui: 'toast',
    message: 'Form submission failed. Please check your inputs.',
    ttl: 4000,
    uiOptions: { severity: 'error' },
  },
}

const systemRegistry: ErrorRegistry<
  'SYS_CRITICAL' | 'SYS_MAINTENANCE' | 'SYS_VERSION_MISMATCH' | 'SYS_SILENT_METRIC'
> = {
  SYS_CRITICAL: {
    ui: 'modal',
    message: 'A critical system error occurred. Please refresh the page.',
    uiOptions: { dismissible: false, size: 'lg' },
  },
  SYS_MAINTENANCE: {
    ui: 'modal',
    message: 'The system is currently under maintenance. Back soon!',
    uiOptions: { dismissible: true, size: 'md' },
  },
  SYS_VERSION_MISMATCH: {
    ui: 'toast',
    message: 'App update available — please refresh.',
    ttl: 8000,
    uiOptions: { severity: 'info', position: 'bottom-center' },
  },
  SYS_SILENT_METRIC: {
    ui: 'silent',
  },
}

const shoppingRegistry: ErrorRegistry<
  'CART_OUT_OF_STOCK' | 'PAYMENT_DECLINED' | 'PAYMENT_FRAUD_DETECTED' | 'ORDER_FAILED'
> = {
  CART_OUT_OF_STOCK: {
    ui: 'toast',
    message: (err: AppError) =>
      `"${String(err.context?.item ?? 'Item')}" is out of stock.`,
    ttl: 5000,
    uiOptions: { severity: 'warning' },
  },
  PAYMENT_DECLINED: {
    ui: 'modal',
    message: 'Your payment was declined. Please check your card details.',
    uiOptions: { dismissible: true, size: 'md' },
  },
  PAYMENT_FRAUD_DETECTED: {
    ui: 'modal',
    message: 'Suspicious activity detected. Your transaction has been blocked for security.',
    uiOptions: { dismissible: false, size: 'lg' },
  },
  ORDER_FAILED: {
    ui: 'toast',
    message: 'Order placement failed. Please try again.',
    ttl: 5000,
    uiOptions: { severity: 'error' },
  },
}

export type AppErrorCode =
  | 'AUTH_EXPIRED'
  | 'AUTH_FORBIDDEN'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_MFA_REQUIRED'
  | 'NETWORK_OFFLINE'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_RATE_LIMITED'
  | 'NETWORK_SERVER_ERROR'
  | 'NETWORK_NOT_FOUND'
  | 'NETWORK_BAD_REQUEST'
  | 'FORM_VALIDATION_EMAIL'
  | 'FORM_VALIDATION_REQUIRED'
  | 'FORM_VALIDATION_MIN_LENGTH'
  | 'FORM_SUBMIT_FAILED'
  | 'SYS_CRITICAL'
  | 'SYS_MAINTENANCE'
  | 'SYS_VERSION_MISMATCH'
  | 'SYS_SILENT_METRIC'
  | 'CART_OUT_OF_STOCK'
  | 'PAYMENT_DECLINED'
  | 'PAYMENT_FRAUD_DETECTED'
  | 'ORDER_FAILED'

const registry = mergeRegistries(
  mergeRegistries(
    mergeRegistries(authRegistry as ErrorRegistry<AppErrorCode>, networkRegistry as ErrorRegistry<AppErrorCode>),
    mergeRegistries(formRegistry as ErrorRegistry<AppErrorCode>, systemRegistry as ErrorRegistry<AppErrorCode>),
  ),
  shoppingRegistry as ErrorRegistry<AppErrorCode>
)

// ── Callback log (reactive, for the CallbacksDemo) ─────────────────────────
export const callbackLog = reactive<Array<{ time: string; type: string; detail: string }>>([])

function logCallback(type: string, detail: string) {
  const now = new Date()
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}.${now.getMilliseconds().toString().padStart(3,'0')}`
  callbackLog.unshift({ time, type, detail })
  if (callbackLog.length > 50) callbackLog.pop()
}

// ── Engine ──────────────────────────────────────────────────────────────────

export const renderer = createVueRenderer()

export const engine = createErrorEngine<AppErrorCode>({
  registry,
  renderer,
  normalizers: [builtInNormalizer],
  fallback: { ui: 'toast', message: 'An unexpected error occurred.' },
  allowFallback: true,
  dedupeWindow: 800,
  maxConcurrent: 3,
  maxQueue: 5,
  debug: { trace: true },

  onError: (raw) => {
    logCallback('onError', typeof raw === 'object' && raw !== null ? JSON.stringify(raw).slice(0, 80) : String(raw))
  },
  onNormalized: (err) => {
    logCallback('onNormalized', `code=${String(err.code)} status=${err.status ?? '-'}`)
  },
  onRouted: (err, action) => {
    logCallback('onRouted', `code=${String(err.code)} → ${action}`)
  },
  onSuppressed: (err, reason) => {
    logCallback('onSuppressed', `code=${String(err.code)} reason="${reason}"`)
  },
  onFallback: (err) => {
    logCallback('onFallback', `code=${String(err.code)} (no registry entry)`)
  },
  onDropped: (err, reason) => {
    logCallback('onDropped', `code=${String(err.code)} reason=${reason}`)
  },
})
