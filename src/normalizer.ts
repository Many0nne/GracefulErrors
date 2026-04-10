import type { AppError, Normalizer, SystemErrorCode } from "./types";

// Native JS error → stable code mapping
function mapNativeError(raw: Error): AppError {
  if (raw instanceof TypeError) {
    return { code: "NETWORK_ERROR", message: raw.message, raw };
  }
  if (raw instanceof DOMException && raw.name === "NetworkError") {
    return { code: "NETWORK_ERROR", message: raw.message, raw };
  }
  const code: SystemErrorCode = "GRACEFULERRORS_UNKNOWN";
  return { code, message: raw.message, raw };
}

// Detect Axios-like error
function isAxiosError(raw: unknown): raw is {
  isAxiosError?: boolean;
  response?: { status?: number; data?: unknown };
  config?: unknown;
  message?: string;
} {
  if (raw == null || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    r["isAxiosError"] === true ||
    (r["response"] !== undefined && r["config"] !== undefined)
  );
}

// Detect structured custom error
function isStructuredError(raw: unknown): raw is {
  code: string;
  status?: number;
  message?: string;
  context?: Record<string, unknown>;
} {
  if (raw == null || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return typeof r["code"] === "string";
}

export function builtInNormalizer(raw: unknown): AppError | null {
  // AbortError — pass-through, never an AppError
  if (raw instanceof Error && raw.name === "AbortError") {
    return null;
  }

  // HTTP Response (4xx/5xx)
  if (raw instanceof Response && !raw.ok) {
    const status = raw.status;
    // Body may have been consumed — use sync fallback
    const code = `HTTP_${status}`;
    return { code, status, message: raw.statusText, raw };
  }

  // Axios error
  if (isAxiosError(raw)) {
    const response = raw.response;
    const status = response?.status;
    const data = response?.data;
    let code: string =
      status != null ? `HTTP_${status}` : "GRACEFULERRORS_UNKNOWN";
    let message: string | undefined;

    if (data != null && typeof data === "object") {
      const d = data as Record<string, unknown>;
      if (typeof d["code"] === "string") code = d["code"];
      if (typeof d["message"] === "string") message = d["message"];
    }

    return { code, status, message, raw };
  }

  // Structured custom error — plain object with { code: string }
  if (isStructuredError(raw)) {
    const { code, status, message, context } = raw;
    return { code, status, message, context, raw };
  }

  // Native JS errors
  if (raw instanceof Error) {
    return mapNativeError(raw);
  }

  // Unknown
  return null;
}

export function mergeAppError<
  TCode extends string,
  TField extends string = string,
>(
  current: AppError<TCode, TField> | null,
  partial: AppError<TCode, TField>,
): AppError<TCode, TField> {
  if (current === null) {
    return partial;
  }

  const merged: AppError<TCode, TField> = { ...current };

  // Later defined scalar fields win; undefined never overwrites an existing value
  if (partial.code !== undefined) merged.code = partial.code;
  if (partial.status !== undefined) merged.status = partial.status;
  if (partial.message !== undefined) merged.message = partial.message;

  // context is shallow-merged with later keys winning
  if (partial.context !== undefined) {
    merged.context = { ...current.context, ...partial.context };
  }

  // raw remains the original input (never overwritten)
  // (already set from current)

  return merged;
}

export function runNormalizerPipeline<
  TCode extends string,
  TField extends string,
>(
  raw: unknown,
  customNormalizers: Normalizer<TCode, TField>[],
  builtIn: Normalizer<TCode, TField>,
  onError?: (raw: unknown) => void,
): AppError<TCode, TField> {
  let current: AppError<TCode, TField> | null = null;

  // Run each custom normalizer
  for (const normalizer of customNormalizers) {
    try {
      const result = normalizer(raw, current);
      if (result !== null) {
        current = mergeAppError(current, result);
      }
    } catch (err) {
      onError?.(err);
    }
  }

  // Run built-in normalizer
  try {
    const result = builtIn(raw, current);
    if (result !== null) {
      current = mergeAppError(current, result);
    }
  } catch (err) {
    onError?.(err);
  }

  // If final current is null → synthesize GRACEFULERRORS_UNHANDLED
  if (current === null) {
    return { code: "GRACEFULERRORS_UNHANDLED" as TCode, raw } as AppError<
      TCode,
      TField
    >;
  }

  // If final current has no code → assign GRACEFULERRORS_UNKNOWN
  if (!current.code) {
    return { ...current, code: "GRACEFULERRORS_UNKNOWN" as TCode };
  }

  return current;
}
