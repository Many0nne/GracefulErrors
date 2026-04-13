import type {
  AppError,
  ErrorRegistry,
  ErrorRegistryEntry,
  ErrorRegistryEntryFull,
  MessageResolver,
} from "./types";

export function lookupEntry<TCode extends string>(
  registry: ErrorRegistry<TCode>,
  code: TCode | string,
): ErrorRegistryEntryFull<TCode> | undefined {
  return (
    registry as Record<string, ErrorRegistryEntryFull<TCode> | undefined>
  )[code];
}

export function resolveMessage<TCode extends string>(
  entry: ErrorRegistryEntry<TCode>,
  error: AppError<TCode>,
  messageResolver?: MessageResolver<TCode>,
): string | undefined {
  if (entry.message === undefined) return undefined;
  // Function-based messages are already dynamic — bypass the resolver.
  if (typeof entry.message === "function") return entry.message(error);
  // String messages are treated as i18n keys when a resolver is provided.
  if (messageResolver) return messageResolver(entry.message, error);
  return entry.message;
}

/**
 * Merges two error registries into one, with entries from `override` taking
 * precedence over `base` when both define the same key.
 *
 * Useful for combining a shared base registry (e.g. from `createHttpPreset`)
 * with application-specific overrides, or for composing feature-level registries
 * without losing the TypeScript union of their code types.
 *
 * @param base - The base registry whose entries can be overridden.
 * @param override - Registry whose entries win on key conflicts.
 * @returns A new registry typed as `ErrorRegistry<TBase | TExtended>`.
 *
 * @example
 * ```ts
 * const registry = mergeRegistries(createHttpPreset(), {
 *   AUTH_FAILED: { ui: 'modal', message: 'Session expired.' },
 * });
 * ```
 */
export function mergeRegistries<TBase extends string, TExtended extends string>(
  base: ErrorRegistry<TBase>,
  override: ErrorRegistry<TExtended>,
): ErrorRegistry<TBase | TExtended> {
  return { ...base, ...override } as ErrorRegistry<TBase | TExtended>;
}

export type {
  ErrorRegistry,
  ErrorRegistryEntry,
  ErrorRegistryEntryFull,
} from "./types";
