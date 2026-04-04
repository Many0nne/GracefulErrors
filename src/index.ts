// Public API â€” gracefulerrors
export { createErrorEngine, createFetch } from './engine'
export { mergeRegistries } from './registry'
export { builtInNormalizer } from './normalizer'

export type {
  AppError,
  ErrorEngine,
  ErrorEngineConfig,
  HandleResult,
  ErrorRegistry,
  ErrorRegistryEntry,
  ErrorRegistryEntryFull,
  Normalizer,
  RendererAdapter,
  RenderIntent,
  RoutingStrategy,
  TransformResult,
  TransformContext,
  UIAction,
  UIOptions,
} from './types'
