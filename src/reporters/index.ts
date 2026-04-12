import type {
  AppError,
  ErrorReporter,
  HandleResult,
  ReporterContext,
  UIAction,
} from "../types";

// ---------------------------------------------------------------------------
// Shared filter utilities
// ---------------------------------------------------------------------------

export type ReporterFilterOptions<TCode extends string = string> = {
  /** Error codes to skip. */
  ignore?: TCode[];
  /** Only report errors whose uiAction is in this list. Suppressed/deduped errors have no action. */
  actions?: UIAction[];
  /** When true, only report errors that were fully handled (not suppressed/deduped/dropped). */
  handledOnly?: boolean;
  /** Only report errors whose status falls within [min, max] (inclusive). */
  statusRange?: { min?: number; max?: number };
  /** Custom predicate — return false to skip reporting. */
  filter?: (error: AppError<TCode>, context: ReporterContext<TCode>) => boolean;
};

function isOutOfActionScope<TCode extends string>(
  context: ReporterContext<TCode>,
  opts: ReporterFilterOptions<TCode>,
): boolean {
  if (!opts.actions) return false;
  const action: UIAction | null = context.result.handled
    ? context.result.uiAction
    : null;
  return !action || !opts.actions.includes(action);
}

function isOutOfStatusRange<TCode extends string>(
  error: AppError<TCode>,
  opts: ReporterFilterOptions<TCode>,
): boolean {
  if (!opts.statusRange) return false;
  const { min, max } = opts.statusRange;
  const { status } = error;
  if (status === undefined) return true;
  return (
    (min !== undefined && status < min) || (max !== undefined && status > max)
  );
}

function shouldSkip<TCode extends string>(
  error: AppError<TCode>,
  context: ReporterContext<TCode>,
  opts: ReporterFilterOptions<TCode>,
): boolean {
  if (opts.ignore?.includes(error.code as TCode)) return true;
  if (opts.handledOnly && !context.result.handled) return true;
  if (isOutOfActionScope(context, opts)) return true;
  if (isOutOfStatusRange(error, opts)) return true;
  if (opts.filter && !opts.filter(error, context)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Sentry reporter
// ---------------------------------------------------------------------------

export type SentryLevel =
  | "fatal"
  | "error"
  | "warning"
  | "info"
  | "debug"
  | "log";

/** Minimal Sentry SDK surface used by the reporter. Compatible with @sentry/browser and @sentry/node. */
export type SentryLike = {
  captureException(
    exception: unknown,
    captureContext?: {
      level?: SentryLevel;
      tags?: Record<string, string | number | boolean | null | undefined>;
      extra?: Record<string, unknown>;
      fingerprint?: string[];
    },
  ): string;
};

export type SentryReporterOptions<TCode extends string = string> =
  ReporterFilterOptions<TCode> & {
    /**
     * Map error to a Sentry severity level.
     * Default: status >= 500 → 'error', else 'warning'. Missing status → 'error'.
     */
    level?: (
      error: AppError<TCode>,
      context: ReporterContext<TCode>,
    ) => SentryLevel;
    /**
     * Add extra tags merged on top of the built-in gracefulerrors.* tags.
     */
    tags?: (
      error: AppError<TCode>,
      context: ReporterContext<TCode>,
    ) => Record<string, string | number | boolean | null | undefined>;
  };

function defaultSentryLevel(status: number | undefined): SentryLevel {
  return (status ?? 500) >= 500 ? "error" : "warning";
}

export function createSentryReporter<TCode extends string = string>(
  sentry: SentryLike,
  options: SentryReporterOptions<TCode> = {},
): ErrorReporter<TCode> {
  return function sentryReporter(
    error: AppError<TCode>,
    context: ReporterContext<TCode>,
  ) {
    if (shouldSkip(error, context, options)) return;

    const level: SentryLevel = options.level
      ? options.level(error, context)
      : defaultSentryLevel(error.status);

    const extraTags = options.tags ? options.tags(error, context) : {};

    sentry.captureException(error.raw ?? error, {
      level,
      tags: {
        "gracefulerrors.code": error.code,
        "gracefulerrors.status": error.status,
        "gracefulerrors.fingerprint": context.fingerprint,
        ...extraTags,
      },
      extra: {
        code: error.code,
        status: error.status,
        message: error.message,
        context: error.context,
      },
      fingerprint: [context.fingerprint],
    });
  };
}

// ---------------------------------------------------------------------------
// Datadog RUM reporter
// ---------------------------------------------------------------------------

/** Minimal Datadog RUM SDK surface. Compatible with @datadog/browser-rum. */
export type DatadogRumLike = {
  addError(error: unknown, context?: Record<string, unknown>): void;
};

export type DatadogReporterOptions<TCode extends string = string> =
  ReporterFilterOptions<TCode> & {
    /**
     * Add extra context merged on top of the built-in gracefulerrors.* fields.
     */
    context?: (
      error: AppError<TCode>,
      context: ReporterContext<TCode>,
    ) => Record<string, unknown>;
  };

export function createDatadogReporter<TCode extends string = string>(
  datadogRum: DatadogRumLike,
  options: DatadogReporterOptions<TCode> = {},
): ErrorReporter<TCode> {
  return function datadogReporter(
    error: AppError<TCode>,
    context: ReporterContext<TCode>,
  ) {
    if (shouldSkip(error, context, options)) return;

    const extraContext = options.context ? options.context(error, context) : {};

    datadogRum.addError(error.raw ?? error, {
      "gracefulerrors.code": error.code,
      "gracefulerrors.status": error.status,
      "gracefulerrors.fingerprint": context.fingerprint,
      "gracefulerrors.message": error.message,
      ...extraContext,
    });
  };
}

// ---------------------------------------------------------------------------
// Webhook reporter
// ---------------------------------------------------------------------------

export type WebhookReporterOptions<TCode extends string = string> =
  ReporterFilterOptions<TCode> & {
    /** Endpoint URL to POST (or PUT) the error payload to. */
    url: string;
    method?: "POST" | "PUT";
    /** Additional HTTP headers. Content-Type: application/json is always set. */
    headers?: Record<string, string>;
    /**
     * Transform the error before sending.
     * Default payload: { code, status, message, fingerprint, uiAction }.
     */
    body?: (error: AppError<TCode>, context: ReporterContext<TCode>) => unknown;
  };

export function createWebhookReporter<TCode extends string = string>(
  options: WebhookReporterOptions<TCode>,
): ErrorReporter<TCode> {
  return async function webhookReporter(
    error: AppError<TCode>,
    context: ReporterContext<TCode>,
  ) {
    if (shouldSkip(error, context, options)) return;

    const payload = options.body
      ? options.body(error, context)
      : {
          code: error.code,
          status: error.status,
          message: error.message,
          fingerprint: context.fingerprint,
          uiAction:
            (context.result as HandleResult<TCode> & { uiAction?: UIAction })
              .uiAction ?? null,
        };

    await fetch(options.url, {
      method: options.method ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: JSON.stringify(payload),
    });
  };
}

// Re-export core types so consumers only need one import
export type { ErrorReporter, ReporterContext } from "../types";
