import { builtInNormalizer, runNormalizerPipeline } from './normalizer'
import { createUIRouter } from './router'
import { lookupEntry } from './registry'
import type {
  AppError,
  ErrorRegistry,
  ErrorEngineConfig,
  HandleResult,
  Normalizer,
  UIAction,
} from './types'

export interface MockEngineCall<TCode extends string = string> {
  error: AppError<TCode>
  uiAction: UIAction | null
}

export interface MockEngine<TCode extends string = string> {
  handle(raw: unknown): HandleResult<TCode>
  clear(code: TCode): void
  clearAll(): void
  subscribe(): () => void
  calls: MockEngineCall<TCode>[]
  reset(): void
}

export interface MockEngineConfig<TCode extends string = string, TField extends string = string> {
  registry?: ErrorRegistry<TCode>
  fallback?: ErrorEngineConfig<TCode, TField>['fallback']
  normalizers?: Normalizer<TCode, TField>[]
}

export function createMockEngine<TCode extends string = string, TField extends string = string>(
  config: MockEngineConfig<TCode, TField> = {}
): MockEngine<TCode> {
  const registry = config.registry ?? ({} as ErrorRegistry<TCode>)
  const router = createUIRouter<TCode, TField>()
  const calls: MockEngineCall<TCode>[] = []

  function handle(raw: unknown): HandleResult<TCode> {
    const normalized = runNormalizerPipeline(
      raw,
      config.normalizers ?? [],
      builtInNormalizer as unknown as Normalizer<TCode, TField>
    ) as AppError<TCode, TField>

    const entry = lookupEntry(registry, normalized.code as TCode)

    const uiAction = router.route(normalized, registry, {
      fallback: config.fallback,
      resolvedEntry: entry,
    }) as UIAction

    const result: HandleResult<TCode> = {
      handled: true,
      error: normalized,
      uiAction: uiAction === 'silent' ? null : uiAction,
    }

    calls.push({ error: normalized, uiAction: result.uiAction })

    return result
  }

  return {
    handle,
    clear: () => undefined,
    clearAll: () => undefined,
    subscribe: () => () => undefined,
    calls,
    reset() {
      calls.length = 0
    },
  }
}
