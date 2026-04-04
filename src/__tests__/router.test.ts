import { describe, it, expect, vi } from 'vitest'
import { createUIRouter } from '../router'
import type { AppError, ErrorRegistry, RoutingStrategy, UIAction } from '../types'

type Code = 'NOT_FOUND' | 'UNAUTHORIZED' | 'NETWORK_ERROR'

const registry: ErrorRegistry<Code> = {
  NOT_FOUND: { ui: 'toast', message: 'Not found' },
  UNAUTHORIZED: { ui: 'modal', message: 'Unauthorized' },
}

const baseConfig = {
  routingContext: { activeCount: 0, queueLength: 0 },
}

describe('Registry match', () => {
  it('error with registry entry â†’ returns entry.ui', () => {
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'NOT_FOUND' }
    expect(router.route(error, registry, baseConfig)).toBe('toast')
  })

  it('routingStrategy returning non-null â†’ overrides entry', () => {
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'NOT_FOUND' }
    const strategy: RoutingStrategy<Code> = () => 'inline'
    expect(router.route(error, registry, { ...baseConfig, routingStrategy: strategy })).toBe('inline')
  })

  it('routingStrategy returning null â†’ falls through to entry', () => {
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'NOT_FOUND' }
    const strategy: RoutingStrategy<Code> = () => null
    expect(router.route(error, registry, { ...baseConfig, routingStrategy: strategy })).toBe('toast')
  })
})

describe('Fallback', () => {
  const error: AppError<Code> = { code: 'NETWORK_ERROR' }

  it('no registry entry, allowFallback: true, fallback configured â†’ returns fallback.ui', () => {
    const router = createUIRouter<Code>()
    expect(router.route(error, registry, {
      ...baseConfig,
      allowFallback: true,
      fallback: { ui: 'modal' },
    })).toBe('modal')
  })

  it('no registry entry, allowFallback: false â†’ returns toast (hard default)', () => {
    const router = createUIRouter<Code>()
    expect(router.route(error, registry, {
      ...baseConfig,
      allowFallback: false,
      fallback: { ui: 'modal' },
    })).toBe('toast')
  })

  it('no registry entry, allowFallback undefined (default true), fallback configured â†’ returns fallback.ui', () => {
    const router = createUIRouter<Code>()
    expect(router.route(error, registry, {
      ...baseConfig,
      fallback: { ui: 'silent' },
    })).toBe('silent')
  })

  it('no registry entry, no fallback configured â†’ returns toast', () => {
    const router = createUIRouter<Code>()
    expect(router.route(error, registry, baseConfig)).toBe('toast')
  })
})

describe('requireRegistry', () => {
  it('requireRegistry: true + no entry â†’ throws', () => {
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'NETWORK_ERROR' }
    expect(() => router.route(error, registry, { ...baseConfig, requireRegistry: true })).toThrow(
      '[gracefulerrors] Registry entry required for code: NETWORK_ERROR'
    )
  })

  it('router does not call onFallback (engine responsibility)', () => {
    const onFallback = vi.fn()
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'NETWORK_ERROR' }
    router.route(error, registry, { ...baseConfig, fallback: { ui: 'toast' } })
    expect(onFallback).not.toHaveBeenCalled()
  })
})

describe('routingStrategy context', () => {
  it('activeCount and queueLength are passed correctly to the strategy', () => {
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'NOT_FOUND' }
    const strategy = vi.fn((): UIAction => 'toast')
    router.route(error, registry, {
      routingContext: { activeCount: 2, queueLength: 1 },
      routingStrategy: strategy,
    })
    expect(strategy).toHaveBeenCalledWith(
      error,
      registry['NOT_FOUND'],
      { activeCount: 2, queueLength: 1 }
    )
  })

  it('strategy can downgrade modal to toast based on activeCount', () => {
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'UNAUTHORIZED' }
    const strategy: RoutingStrategy<Code> = (_err, _entry, ctx) =>
      ctx.activeCount >= 2 ? 'toast' : null
    expect(router.route(error, registry, {
      routingContext: { activeCount: 2, queueLength: 0 },
      routingStrategy: strategy,
    })).toBe('toast')
    expect(router.route(error, registry, {
      routingContext: { activeCount: 1, queueLength: 0 },
      routingStrategy: strategy,
    })).toBe('modal') // falls through to registry
  })
})

describe('Edge cases', () => {
  it('routingStrategy throws â†’ treated as returning null (continue to registry lookup)', () => {
    const router = createUIRouter<Code>()
    const error: AppError<Code> = { code: 'NOT_FOUND' }
    const strategy: RoutingStrategy<Code> = () => { throw new Error('strategy boom') }
    expect(router.route(error, registry, { ...baseConfig, routingStrategy: strategy })).toBe('toast')
  })
})
