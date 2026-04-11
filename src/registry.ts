import type {
  AppError,
  ErrorRegistry,
  ErrorRegistryEntry,
  ErrorRegistryEntryFull,
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
): string | undefined {
  if (entry.message === undefined) return undefined;
  if (typeof entry.message === "function") return entry.message(error);
  return entry.message;
}

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
