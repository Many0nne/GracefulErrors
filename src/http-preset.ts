import type { ErrorRegistry, ErrorRegistryEntry } from "./types";

export type HttpPresetCode =
  | "HTTP_400"
  | "HTTP_401"
  | "HTTP_403"
  | "HTTP_404"
  | "HTTP_409"
  | "HTTP_422"
  | "HTTP_429"
  | "HTTP_500"
  | "HTTP_502"
  | "HTTP_503"
  | "HTTP_504";

const defaults: ErrorRegistry<HttpPresetCode> = {
  HTTP_400: {
    ui: "toast",
    message: "Bad request.",
    uiOptions: { severity: "warning" },
  },
  HTTP_401: {
    ui: "modal",
    message: "Authentication required. Please log in.",
    uiOptions: { dismissible: false },
  },
  HTTP_403: {
    ui: "toast",
    message: "Access denied.",
    uiOptions: { severity: "error" },
  },
  HTTP_404: {
    ui: "toast",
    message: "Resource not found.",
    uiOptions: { severity: "warning" },
  },
  HTTP_409: {
    ui: "toast",
    message: "Conflict. The resource already exists.",
    uiOptions: { severity: "warning" },
  },
  HTTP_422: {
    ui: "toast",
    message: "Unprocessable request. Please check your input.",
    uiOptions: { severity: "warning" },
  },
  HTTP_429: {
    ui: "toast",
    message: "Too many requests. Please slow down.",
    uiOptions: { severity: "warning" },
  },
  HTTP_500: {
    ui: "toast",
    message: "Internal server error.",
    uiOptions: { severity: "error" },
  },
  HTTP_502: {
    ui: "toast",
    message: "Bad gateway.",
    uiOptions: { severity: "error" },
  },
  HTTP_503: {
    ui: "toast",
    message: "Service unavailable. Please try again later.",
    uiOptions: { severity: "error" },
  },
  HTTP_504: {
    ui: "toast",
    message: "Gateway timeout. Please try again later.",
    uiOptions: { severity: "error" },
  },
};

/**
 * Returns a ready-to-use error registry covering the most common HTTP status codes
 * (400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504) with sensible default
 * messages and UI actions.
 *
 * Pass an `overrides` map to replace individual entries while keeping the rest of
 * the defaults intact. The returned registry can be spread into a larger registry
 * or passed directly to `createErrorEngine`.
 *
 * @param overrides - Partial map of `HttpPresetCode` → `ErrorRegistryEntry` to
 *   replace individual defaults.
 * @returns A complete `ErrorRegistry<HttpPresetCode>` with defaults merged with
 *   any provided overrides.
 *
 * @example
 * ```ts
 * const engine = createErrorEngine({
 *   registry: {
 *     ...createHttpPreset({ HTTP_401: { ui: 'modal', message: 'Please log in again.' } }),
 *     CUSTOM_ERROR: { ui: 'toast', message: 'Something went wrong.' },
 *   },
 * });
 * ```
 */
export function createHttpPreset(overrides?: {
  [K in HttpPresetCode]?: ErrorRegistryEntry<HttpPresetCode>;
}): ErrorRegistry<HttpPresetCode> {
  if (!overrides) return { ...defaults };
  return { ...defaults, ...overrides };
}
