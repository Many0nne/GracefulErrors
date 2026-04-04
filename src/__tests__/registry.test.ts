import { describe, it, expect } from 'vitest'
import { lookupEntry, resolveMessage, mergeRegistries } from '../registry'
import type { AppError, ErrorRegistry } from '../types'

type TestCode = 'NOT_FOUND' | 'UNAUTHORIZED' | 'NETWORK_ERROR'

const registry: ErrorRegistry<TestCode> = {
  NOT_FOUND: { ui: 'toast', message: 'Resource not found' },
  UNAUTHORIZED: { ui: 'modal', message: (err) => `Unauthorized: ${err.code}` },
}

describe('lookupEntry', () => {
  it('returns entry when code exists', () => {
    const entry = lookupEntry(registry, 'NOT_FOUND')
    expect(entry).toBeDefined()
    expect(entry!.ui).toBe('toast')
  })

  it('returns undefined when code not in registry', () => {
    expect(lookupEntry(registry, 'NETWORK_ERROR')).toBeUndefined()
  })

  it('works with string fallback (no generic constraint at runtime)', () => {
    const result = lookupEntry(registry as ErrorRegistry<string>, 'NOT_FOUND')
    expect(result).toBeDefined()
  })
})

describe('resolveMessage', () => {
  const error: AppError<TestCode> = { code: 'UNAUTHORIZED' }

  it('returns string message directly', () => {
    const entry = registry['NOT_FOUND']!
    expect(resolveMessage(entry, error)).toBe('Resource not found')
  })

  it('calls function message with error and returns result', () => {
    const entry = registry['UNAUTHORIZED']!
    expect(resolveMessage(entry, error)).toBe('Unauthorized: UNAUTHORIZED')
  })

  it('returns undefined when entry has no message', () => {
    expect(resolveMessage({ ui: 'silent' }, error)).toBeUndefined()
  })
})

describe('mergeRegistries', () => {
  type BaseCode = 'NETWORK_ERROR' | 'TIMEOUT'
  type AppCode = BaseCode | 'USER_NOT_FOUND' | 'PAYMENT_FAILED'

  const base: ErrorRegistry<BaseCode> = {
    NETWORK_ERROR: { ui: 'toast', message: 'Network error' },
    TIMEOUT: { ui: 'toast', message: 'Timeout' },
  }

  const override: ErrorRegistry<AppCode> = {
    NETWORK_ERROR: { ui: 'modal', message: 'Connection failed' },
    USER_NOT_FOUND: { ui: 'toast', message: 'User not found' },
    PAYMENT_FAILED: { ui: 'modal', message: 'Payment failed' },
  }

  it('override key overwrites base key for same code', () => {
    const merged = mergeRegistries(base, override)
    expect(merged['NETWORK_ERROR']?.ui).toBe('modal')
    expect(merged['NETWORK_ERROR']?.message).toBe('Connection failed')
  })

  it('base-only keys are preserved', () => {
    const merged = mergeRegistries(base, override)
    expect(merged['TIMEOUT']).toEqual({ ui: 'toast', message: 'Timeout' })
  })

  it('override-only keys are included', () => {
    const merged = mergeRegistries(base, override)
    expect(merged['USER_NOT_FOUND']?.ui).toBe('toast')
    expect(merged['PAYMENT_FAILED']?.ui).toBe('modal')
  })

  it('does not mutate either input', () => {
    const baseCopy = { ...base }
    const overrideCopy = { ...override }
    mergeRegistries(base, override)
    expect(base).toEqual(baseCopy)
    expect(override).toEqual(overrideCopy)
  })
})
