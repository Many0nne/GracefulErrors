// Public API — gracefulerrors
export { createErrorEngine, createFetch } from "./engine";
export { mergeRegistries } from "./registry";
export { builtInNormalizer } from "./normalizer";
export { createHttpPreset } from "./http-preset";
export type { HttpPresetCode } from "./http-preset";

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
} from "./types";
