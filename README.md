# gracefulerrors

**Turn technical errors into consistent, user-friendly experiences.**

Most applications handle errors inconsistently: some show a toast, others throw an unhandled rejection, others silently swallow the failure. `gracefulerrors` gives you a single place to declare how every error code should be presented — and wires that automatically to React, Vue, Sonner, Axios, or any custom renderer.

```
npm install gracefulerrors
```

---

## Table of contents

- [Quick start](#quick-start)
- [HTTP preset](#http-preset)
- [Configuration reference](#configuration-reference)
- [Fetch wrapper](#fetch-wrapper)
- [Axios interceptor](#axios-interceptor)
- [React integration](#react-integration)
- [Vue integration](#vue-integration)
- [Renderer adapters](#renderer-adapters)
- [Observability reporters](#observability-reporters)
- [SSR / server-side usage](#ssr--server-side-usage)
- [i18n — localized messages](#i18n--localized-messages)
- [Error history](#error-history)
- [Testing](#testing)
- [API reference](#api-reference)
- [Entry points](#entry-points)

---

## Quick start

```ts
import { createErrorEngine } from "gracefulerrors";

type AppCode = "AUTH_FAILED" | "NETWORK_ERROR";

const engine = createErrorEngine<AppCode>({
  registry: {
    AUTH_FAILED: {
      ui: "modal",
      message: "Your session expired. Please sign in again.",
      uiOptions: { dismissible: false },
    },
    NETWORK_ERROR: {
      ui: "toast",
      message: "Connection problem. Please try again.",
      uiOptions: { severity: "error" },
    },
  },
  fallback: { ui: "toast", message: "Something went wrong." },
});

const result = engine.handle(new Error("401 Unauthorized"));
// result.handled === true
// result.uiAction === "modal"  (matched AUTH_FAILED via normalizer)
```

The engine normalizes the raw input (any `Error`, `Response`, Axios error, or plain object), looks up the matching registry entry, and — if a renderer is configured — renders the UI automatically. Without a renderer, `handle()` returns the routing decision so you can render it yourself.

---

## HTTP preset

For most HTTP-driven apps, `createHttpPreset` provides a ready-made registry covering the common status codes (400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504) with sensible defaults. It is the fastest path to a working setup.

```ts
import { createErrorEngine, createHttpPreset } from "gracefulerrors";
import { createSonnerAdapter, SonnerToaster } from "gracefulerrors/sonner";

const engine = createErrorEngine({
  registry: {
    // Built-in defaults for all common HTTP codes:
    ...createHttpPreset(),
    // Override a single entry:
    // ...createHttpPreset({ HTTP_401: { ui: "modal", message: "Please log in again." } }),
    // Your own codes alongside:
    PAYMENT_FAILED: { ui: "modal", message: "Payment could not be processed." },
  },
  fallback: { ui: "toast", message: "Something went wrong." },
  renderer: createSonnerAdapter(),
});
```

`HttpPresetCode` is also exported so you can include it in your own code union:

```ts
import type { HttpPresetCode } from "gracefulerrors";

type AppCode = HttpPresetCode | "PAYMENT_FAILED" | "VALIDATION_ERROR";
```

---

## Configuration reference

`createErrorEngine<TCode>(config)` accepts the following options. All are optional except `registry`.

### Core

| Option            | Type                   | Default | Description                                                                               |
| ----------------- | ---------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `registry`        | `ErrorRegistry<TCode>` | —       | **Required.** Maps each error code to a UI action and message.                            |
| `fallback`        | `{ ui, message? }`     | —       | UI shown when no registry entry matches. `ui` can be `"toast"`, `"modal"`, or `"silent"`. |
| `requireRegistry` | `boolean`              | `false` | When `true`, unregistered codes are silently dropped instead of falling back.             |
| `allowFallback`   | `boolean`              | `true`  | When `false`, the fallback config is ignored and `"toast"` is used as a hard default.     |
| `renderer`        | `RendererAdapter`      | —       | Rendering adapter (Sonner, react-hot-toast, or custom).                                   |

### Normalization

| Option        | Type           | Default | Description                                                    |
| ------------- | -------------- | ------- | -------------------------------------------------------------- |
| `normalizer`  | `Normalizer`   | —       | Single custom normalizer. Takes precedence over `normalizers`. |
| `normalizers` | `Normalizer[]` | —       | Pipeline of normalizers applied in order.                      |

A normalizer receives the raw input and the current `AppError | null`, and returns an `AppError` or `null`. `builtInNormalizer` is always prepended to the pipeline.

### Deduplication and throughput

| Option          | Type                              | Default             | Description                                                         |
| --------------- | --------------------------------- | ------------------- | ------------------------------------------------------------------- |
| `dedupeWindow`  | `number` (ms)                     | `300`               | Identical errors within this window are silently dropped.           |
| `maxConcurrent` | `number`                          | `3`                 | Maximum number of errors rendered at the same time.                 |
| `maxQueue`      | `number`                          | `25`                | Maximum queue length when `maxConcurrent` is reached.               |
| `aggregation`   | `boolean \| { enabled, window? }` | `false`             | Suppress repeated errors within a burst window (ms, default `300`). |
| `fingerprint`   | `(error) => string`               | `code:status:field` | Custom deduplication key.                                           |

### Routing and transformation

| Option            | Type                                                      | Description                                                                                                                                      |
| ----------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `routingStrategy` | `RoutingStrategy`                                         | Override UI action before registry lookup. Receives the error, the registry entry (if any), and queue context. Return `null` to use the default. |
| `transform`       | `(error, ctx) => AppError \| SuppressionDecision \| null` | Post-normalization transform. Return `{ suppress: true, reason }` to suppress the error entirely.                                                |

### Lifecycle hooks

All hooks are called synchronously unless noted otherwise.

| Option         | Signature                  | Called when                                         |
| -------------- | -------------------------- | --------------------------------------------------- |
| `onError`      | `(raw) => void`            | Any input is received by `handle()`.                |
| `onNormalized` | `(error) => void`          | Normalization succeeds.                             |
| `onRouted`     | `(error, action) => void`  | Routing resolves to a UI action.                    |
| `onFallback`   | `(error) => void`          | The fallback entry is used.                         |
| `onSuppressed` | `(error, reason) => void`  | Error is suppressed by `transform`.                 |
| `onDropped`    | `(error, reason) => void`  | Error is deduped, TTL-expired, or queue-overflowed. |
| `onErrorAsync` | `(error) => Promise<void>` | After routing — async, fires and forgets.           |

### Observability and debugging

| Option                  | Type                    | Description                                                                                              |
| ----------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `reporters`             | `ErrorReporter[]`       | Forward errors to Sentry, Datadog, or webhooks. See [Observability reporters](#observability-reporters). |
| `history`               | `HistoryConfig`         | Control the in-memory error history. See [Error history](#error-history).                                |
| `messageResolver`       | `MessageResolver`       | Resolve registry message strings through an i18n function. See [i18n](#i18n--localized-messages).        |
| `debug`                 | `boolean \| { trace? }` | Enable verbose console logging.                                                                          |
| `modalDismissTimeoutMs` | `number`                | Dev-mode warning delay when a modal is not dismissed (ms).                                               |

---

## Fetch wrapper

`createFetch` wraps the native `fetch` API and forwards failures to the engine automatically.

```ts
import {
  createErrorEngine,
  createFetch,
  createHttpPreset,
} from "gracefulerrors";

const engine = createErrorEngine({
  registry: createHttpPreset(),
  fallback: { ui: "toast", message: "Something went wrong." },
});

const apiFetch = createFetch(engine, { mode: "handle" });

// Errors are automatically sent to the engine — no try/catch needed.
const data = await apiFetch("/api/profile");
```

### Modes

| Mode                | Behavior                                                                     |
| ------------------- | ---------------------------------------------------------------------------- |
| `"throw"` (default) | Notifies the engine, then re-throws the original error.                      |
| `"handle"`          | Notifies the engine, then resolves `undefined`. Caller never sees the error. |
| `"silent"`          | Passes through failures without notifying the engine.                        |

---

## Axios interceptor

`createAxiosInterceptor` installs a response interceptor on any Axios instance. It has the same three modes as `createFetch`.

```ts
import axios from "axios";
import { createErrorEngine, createHttpPreset } from "gracefulerrors";
import { createAxiosInterceptor } from "gracefulerrors/axios";

const engine = createErrorEngine({ registry: createHttpPreset() });

const apiClient = axios.create({ baseURL: "/api" });

// Returns an unsubscribe function.
const unsubscribe = createAxiosInterceptor(apiClient, engine, {
  mode: "throw",
});

// Later, to remove the interceptor:
// unsubscribe();
```

### Modes

| Mode                | Behavior                                                                         |
| ------------------- | -------------------------------------------------------------------------------- |
| `"throw"` (default) | Forwards error to engine, then re-throws so the caller's `.catch()` still fires. |
| `"handle"`          | Forwards error to engine, then resolves `undefined`.                             |
| `"silent"`          | Passes through without notifying the engine.                                     |

---

## React integration

Install peer dependencies:

```bash
npm install react react-dom
```

### Provider and hook

```tsx
import { createErrorEngine, createHttpPreset } from "gracefulerrors";
import { ErrorEngineProvider, useErrorEngine } from "gracefulerrors/react";
import { createSonnerAdapter, SonnerToaster } from "gracefulerrors/sonner";

const engine = createErrorEngine({
  registry: createHttpPreset(),
  fallback: { ui: "toast", message: "Something went wrong." },
  renderer: createSonnerAdapter(),
});

export function App() {
  return (
    <ErrorEngineProvider engine={engine}>
      <SonnerToaster />
      <ProfilePage />
    </ErrorEngineProvider>
  );
}

function ProfilePage() {
  const engine = useErrorEngine();

  async function handleSave() {
    try {
      await fetch("/api/profile", { method: "POST" });
    } catch (err) {
      engine?.handle(err);
    }
  }

  return <button onClick={handleSave}>Save</button>;
}
```

### Inline / form field errors

`useFieldError(field)` returns the latest `AppError` routed to `ui: "inline"` for a specific field name.

```tsx
import { useFieldError } from "gracefulerrors/react";

function EmailInput() {
  const { error } = useFieldError("email");

  return (
    <div>
      <input type="email" aria-invalid={!!error} />
      {error && <p role="alert">{error.message}</p>}
    </div>
  );
}
```

The engine must route an error with `ui: "inline"` and `context.field: "email"` for this to update.

### Error boundary

`ErrorBoundaryWithEngine` catches unhandled React render errors and forwards them to the engine.

```tsx
import { ErrorBoundaryWithEngine } from "gracefulerrors/react";

function App() {
  return (
    <ErrorEngineProvider engine={engine}>
      <ErrorBoundaryWithEngine fallback={<p>Something went wrong.</p>}>
        <RiskyComponent />
      </ErrorBoundaryWithEngine>
    </ErrorEngineProvider>
  );
}
```

### React exports

| Export                    | Description                                                 |
| ------------------------- | ----------------------------------------------------------- |
| `ErrorEngineProvider`     | Context provider wrapping the engine instance.              |
| `useErrorEngine()`        | Returns the engine from context.                            |
| `useFieldError(field)`    | Subscribes to inline errors for a named field.              |
| `ErrorBoundaryWithEngine` | Class component error boundary that forwards to the engine. |

---

## Vue integration

Install peer dependency:

```bash
npm install vue
```

### Global plugin

```ts
import { createApp } from "vue";
import { createErrorEngine, createHttpPreset } from "gracefulerrors";
import { createErrorEnginePlugin } from "gracefulerrors/vue";
import App from "./App.vue";

const engine = createErrorEngine({
  registry: createHttpPreset(),
  fallback: { ui: "toast", message: "Something went wrong." },
});

const app = createApp(App);
app.use(createErrorEnginePlugin(engine));
app.mount("#app");
```

### Composables

Inside any component:

```ts
import { useErrorEngine, useFieldError } from "gracefulerrors/vue";

// Access the engine
const engine = useErrorEngine();
engine?.handle(new Error("something failed"));

// Subscribe to inline field errors
const { error } = useFieldError("email");
// error is Ref<AppError | null>
```

### Subtree injection (alternative to plugin)

```ts
import { provideErrorEngine } from "gracefulerrors/vue";

// Call inside a component setup to scope the engine to a subtree.
provideErrorEngine(engine);
```

### Error boundary component

```vue
<template>
  <ErrorBoundaryWithEngine :fallback="ErrorFallback">
    <RiskyComponent />
  </ErrorBoundaryWithEngine>
</template>

<script setup>
import { ErrorBoundaryWithEngine } from "gracefulerrors/vue";
</script>
```

### Vue exports

| Export                            | Description                                                          |
| --------------------------------- | -------------------------------------------------------------------- |
| `createErrorEnginePlugin(engine)` | Creates a Vue plugin for global registration.                        |
| `useErrorEngine()`                | Composable returning the engine from injection.                      |
| `useFieldError(field)`            | Composable returning a `Ref<AppError \| null>` for a named field.    |
| `provideErrorEngine(engine)`      | Provide the engine to a component subtree without the global plugin. |
| `ErrorBoundaryWithEngine`         | Vue component for catching render errors.                            |

---

## Renderer adapters

### Sonner

```bash
npm install sonner
```

```tsx
import { createSonnerAdapter, SonnerToaster } from "gracefulerrors/sonner";

const engine = createErrorEngine({
  registry,
  renderer: createSonnerAdapter(),
});

// Mount <SonnerToaster /> once in your app root.
function Root() {
  return (
    <>
      <SonnerToaster position="top-right" />
      <App />
    </>
  );
}
```

Severity from `uiOptions.severity` (`"error"` | `"warning"` | `"info"` | `"success"`) maps to the corresponding Sonner method.

### react-hot-toast

```bash
npm install react-hot-toast
```

```tsx
import {
  createHotToastAdapter,
  HotToaster,
} from "gracefulerrors/react-hot-toast";

const engine = createErrorEngine({
  registry,
  renderer: createHotToastAdapter(),
});

function Root() {
  return (
    <>
      <HotToaster />
      <App />
    </>
  );
}
```

### Custom renderer

Implement the `RendererAdapter` interface to connect any notification library:

```ts
import type { RendererAdapter } from "gracefulerrors";

const myAdapter: RendererAdapter = {
  render(intent, { onDismiss }) {
    // intent.ui      — "toast" | "modal" | "inline" | "silent"
    // intent.error   — normalized AppError
    // intent.entry   — registry entry (message, uiOptions, ttl, …)
    myNotify(intent.error.message ?? "Error", { onClose: onDismiss });
  },
  clear(code) {
    myNotify.dismiss(code);
  },
  clearAll() {
    myNotify.dismissAll();
  },
};
```

---

## Observability reporters

Reporters forward errors to external monitoring services after each `handle()` call. Import from `gracefulerrors/reporters`.

### Sentry

```ts
import * as Sentry from "@sentry/browser";
import { createSentryReporter } from "gracefulerrors/reporters";

const engine = createErrorEngine({
  registry,
  reporters: [
    createSentryReporter(Sentry, {
      handledOnly: true, // skip suppressed / deduped errors
      statusRange: { min: 500 }, // only server errors
    }),
  ],
});
```

### Datadog RUM

```ts
import { datadogRum } from "@datadog/browser-rum";
import { createDatadogReporter } from "gracefulerrors/reporters";

const engine = createErrorEngine({
  registry,
  reporters: [createDatadogReporter(datadogRum)],
});
```

### Webhook

```ts
import { createWebhookReporter } from "gracefulerrors/reporters";

const engine = createErrorEngine({
  registry,
  reporters: [
    createWebhookReporter({
      url: "https://hooks.example.com/errors",
      handledOnly: true,
    }),
  ],
});
```

### Reporter filter options

All reporter factories accept the same filter options:

| Option        | Type                      | Description                                          |
| ------------- | ------------------------- | ---------------------------------------------------- |
| `ignore`      | `TCode[]`                 | Error codes to skip.                                 |
| `actions`     | `UIAction[]`              | Only report errors whose `uiAction` is in this list. |
| `handledOnly` | `boolean`                 | Skip suppressed, deduped, and dropped errors.        |
| `statusRange` | `{ min?, max? }`          | Only report errors whose HTTP status falls in range. |
| `filter`      | `(error, ctx) => boolean` | Custom predicate — return `false` to skip.           |

---

## SSR / server-side usage

`createServerEngine` is a timer-free, renderer-free variant safe for per-request instantiation in Next.js, Nuxt, Remix, or plain Node.js.

```ts
// lib/engine.ts
import { createServerEngine } from "gracefulerrors/server";
import { createSentryReporter } from "gracefulerrors/reporters";
import * as Sentry from "@sentry/node";

export function makeRequestEngine() {
  return createServerEngine({
    registry: {
      NOT_FOUND: { ui: "toast", message: "Resource not found." },
      UNAUTHORIZED: { ui: "modal", message: "Please log in." },
    },
    reporters: [createSentryReporter(Sentry)],
  });
}
```

```ts
// app/api/profile/route.ts  (Next.js App Router)
import { makeRequestEngine } from "@/lib/engine";

export async function GET() {
  const engine = makeRequestEngine(); // fresh per request — no shared state

  try {
    const data = await fetchProfile();
    return Response.json(data);
  } catch (err) {
    const result = engine.handle(err);
    return Response.json(
      { error: result.error.message },
      { status: result.error.status ?? 500 },
    );
  }
}
```

`createServerEngine` deliberately omits `dedupeWindow`, `maxConcurrent`, `maxQueue`, `aggregation`, `renderer`, and `modalDismissTimeoutMs` — all of which require timers or DOM.

---

## i18n — localized messages

Pass a `messageResolver` to the engine to run all string-based registry messages through your i18n function.

```ts
import i18n from "./i18n"; // your t() function

const engine = createErrorEngine({
  registry: {
    AUTH_FAILED: { ui: "toast", message: "errors.auth_failed" },
    PAYMENT_FAILED: { ui: "modal", message: "errors.payment_failed" },
  },
  messageResolver: (key, error) => i18n.t(key, { status: error.status }),
});
```

Function-based messages (`message: (error) => string`) bypass the resolver — they are already dynamic.

---

## Error history

The engine keeps an in-memory log of every `handle()` call for debugging.

```ts
const engine = createErrorEngine({
  registry,
  history: { maxEntries: 50, enabled: true },
});

// After some interactions:
const entries = engine.getHistory();
// [{ error, handled: true, uiAction: "toast", handledAt: 1712345678 }, ...]

engine.clearHistory();
```

Defaults: `maxEntries` is `20` in development, `0` (disabled) in production.

---

## Testing

`gracefulerrors/testing` exports a mock engine that lets you assert on `handle()` calls without setting up a full engine.

```ts
import { createMockEngine } from "gracefulerrors/testing";

const mock = createMockEngine();

mock.handle({ code: "AUTH_FAILED", message: "401" });

expect(mock.calls).toHaveLength(1);
expect(mock.calls[0].code).toBe("AUTH_FAILED");
mock.reset();
```

---

## API reference

### Core — `gracefulerrors`

| Export                           | Description                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `createErrorEngine(config)`      | Creates a full client-side engine with deduplication, queuing, and rendering.      |
| `createFetch(engine, options?)`  | Returns a `fetch` wrapper that forwards failures to the engine.                    |
| `createHttpPreset(overrides?)`   | Returns a ready-made registry for common HTTP status codes.                        |
| `mergeRegistries(...registries)` | Deep-merges multiple `ErrorRegistry` objects.                                      |
| `builtInNormalizer`              | The default normalizer (handles `Error`, `Response`, Axios errors, plain objects). |

### Server — `gracefulerrors/server`

| Export                       | Description                               |
| ---------------------------- | ----------------------------------------- |
| `createServerEngine(config)` | Timer-free, renderer-free engine for SSR. |

### React — `gracefulerrors/react`

| Export                    | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `ErrorEngineProvider`     | Context provider.                                    |
| `useErrorEngine()`        | Hook returning the engine from context.              |
| `useFieldError(field)`    | Hook subscribing to inline errors for a named field. |
| `ErrorBoundaryWithEngine` | Error boundary component.                            |

### Vue — `gracefulerrors/vue`

| Export                            | Description                                     |
| --------------------------------- | ----------------------------------------------- |
| `createErrorEnginePlugin(engine)` | Vue plugin factory.                             |
| `useErrorEngine()`                | Composable returning the engine.                |
| `useFieldError(field)`            | Composable returning a `Ref<AppError \| null>`. |
| `provideErrorEngine(engine)`      | Provide engine to a subtree.                    |
| `ErrorBoundaryWithEngine`         | Error boundary component.                       |

### Axios — `gracefulerrors/axios`

| Export                                            | Description                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `createAxiosInterceptor(axios, engine, options?)` | Installs a response interceptor. Returns an unsubscribe function. |

### Sonner adapter — `gracefulerrors/sonner`

| Export                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `createSonnerAdapter()` | Returns a `RendererAdapter` backed by Sonner.  |
| `SonnerToaster`         | Re-export of Sonner's `<Toaster />` component. |

### react-hot-toast adapter — `gracefulerrors/react-hot-toast`

| Export                    | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `createHotToastAdapter()` | Returns a `RendererAdapter` backed by react-hot-toast.  |
| `HotToaster`              | Re-export of react-hot-toast's `<Toaster />` component. |

### Reporters — `gracefulerrors/reporters`

| Export                                        | Description           |
| --------------------------------------------- | --------------------- |
| `createSentryReporter(sentry, options?)`      | Sentry reporter.      |
| `createDatadogReporter(datadogRum, options?)` | Datadog RUM reporter. |
| `createWebhookReporter(options)`              | Webhook reporter.     |

### Testing — `gracefulerrors/testing`

| Export               | Description                           |
| -------------------- | ------------------------------------- |
| `createMockEngine()` | Returns a mock engine for unit tests. |

### Key types

| Type                                     | Description                                        |
| ---------------------------------------- | -------------------------------------------------- |
| `AppError<TCode, TField>`                | Normalized error shape used throughout the engine. |
| `ErrorEngineConfig<TCode, TField>`       | Full config for `createErrorEngine`.               |
| `ServerErrorEngineConfig<TCode, TField>` | Config for `createServerEngine`.                   |
| `ErrorRegistry<TCode>`                   | Map of error codes to registry entries.            |
| `ErrorRegistryEntry<TCode>`              | Per-code UI action, message, TTL, and options.     |
| `HandleResult<TCode>`                    | Return value of `engine.handle()`.                 |
| `RendererAdapter`                        | Interface for custom rendering backends.           |
| `ErrorReporter<TCode>`                   | Interface for observability reporters.             |
| `Normalizer<TCode, TField>`              | Function shape for custom normalizers.             |
| `RoutingStrategy<TCode, TField>`         | Function shape for dynamic routing overrides.      |
| `UIAction`                               | `"toast" \| "modal" \| "inline" \| "silent"`       |
| `HttpPresetCode`                         | Union of all HTTP preset code strings.             |
| `MessageResolver<TCode>`                 | i18n resolver function shape.                      |
| `HistoryEntry<TCode>`                    | Single entry in the error history log.             |

---

## Entry points

| Import path                      | Contents                                               |
| -------------------------------- | ------------------------------------------------------ |
| `gracefulerrors`                 | Core engine, fetch wrapper, presets, normalizer, types |
| `gracefulerrors/react`           | React provider, hooks, error boundary                  |
| `gracefulerrors/vue`             | Vue plugin, composables, error boundary                |
| `gracefulerrors/sonner`          | Sonner renderer adapter                                |
| `gracefulerrors/react-hot-toast` | react-hot-toast renderer adapter                       |
| `gracefulerrors/axios`           | Axios interceptor                                      |
| `gracefulerrors/server`          | SSR-safe server engine                                 |
| `gracefulerrors/reporters`       | Sentry, Datadog, and webhook reporters                 |
| `gracefulerrors/testing`         | Mock engine for unit tests                             |

---

## License

MIT
