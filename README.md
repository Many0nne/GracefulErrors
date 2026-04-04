# gracefulerrors

gracefulerrors is a TypeScript library for turning technical errors into consistent user-facing experiences. It provides a framework-agnostic core engine, a React SDK, and a Sonner adapter.

## Features

- Normalize raw errors into a shared internal format
- Route errors to `toast`, `modal`, `inline`, or `silent`
- Register typed error codes with per-code UI behavior
- Dedupe, queue, and limit concurrent notifications
- Integrate with React through a provider, hooks, and an error boundary
- Render with Sonner or a custom adapter

## Installation

```bash
npm install gracefulerrors
```

If you use the React SDK or the Sonner adapter, install the matching peer dependencies in your app:

```bash
npm install react react-dom sonner
```

## Quick Start

```ts
import { createErrorEngine } from 'gracefulerrors'

type AppCode = 'AUTH_FAILED' | 'PAYMENT_FAILED'

const engine = createErrorEngine<AppCode>({
  registry: {
    AUTH_FAILED: {
      ui: 'toast',
      uiOptions: {
        severity: 'error',
      },
      message: 'Your session expired. Please sign in again.',
    },
    PAYMENT_FAILED: {
      ui: 'modal',
      message: 'Payment could not be processed.',
    },
  },
  fallback: {
    ui: 'toast',
    message: 'Something went wrong.',
  },
})

engine.handle({
  code: 'AUTH_FAILED',
  message: '401 Unauthorized',
})
```

## Fetch Wrapper

`createFetch` wraps the native `fetch` and forwards failures to the engine.

```ts
import { createErrorEngine, createFetch } from 'gracefulerrors'

const engine = createErrorEngine({
  registry: {
    NETWORK_ERROR: { ui: 'toast', message: 'Network error' },
  },
})

const apiFetch = createFetch(engine, { mode: 'handle' })

const response = await apiFetch('/api/profile')
```

Supported modes:

- `throw` returns the original failure after notifying the engine
- `handle` swallows handled failures and returns `undefined`
- `silent` leaves non-OK responses and thrown errors to the caller without notifying the engine

## React Integration

```tsx
import { ErrorEngineProvider, useErrorEngine } from 'gracefulerrors/react'
import { createErrorEngine } from 'gracefulerrors'

const engine = createErrorEngine({
  registry: {
    NETWORK_ERROR: { ui: 'toast', message: 'Network error' },
  },
})

function SaveButton() {
  const errorEngine = useErrorEngine()

  return (
    <button
      onClick={() => {
        errorEngine?.handle({ code: 'NETWORK_ERROR', message: 'Request failed' })
      }}
    >
      Save
    </button>
  )
}

export function App() {
  return (
    <ErrorEngineProvider engine={engine}>
      <SaveButton />
    </ErrorEngineProvider>
  )
}
```

`gracefulerrors/react` also exports:

- `useFieldError(field)` for inline error state
- `ErrorBoundaryWithEngine` for catching runtime errors and forwarding them to the engine

## Sonner Adapter

```tsx
import { SonnerToaster, createSonnerAdapter } from 'gracefulerrors/sonner'
import { createErrorEngine } from 'gracefulerrors'

const engine = createErrorEngine({
  registry: {
    SERVER_ERROR: {
      ui: 'toast',
      severity: 'error',
      message: 'Server error. Please try again.',
    },
  },
  renderer: createSonnerAdapter(),
})

export function Root() {
  return (
    <>
      <SonnerToaster />
      {/* your app */}
    </>
  )
}
```

## Public API

Main entry:

- `createErrorEngine`
- `createFetch`
- `mergeRegistries`
- `builtInNormalizer`

Type exports are available from the root package as well.

Additional entry points:

- `gracefulerrors/react`
- `gracefulerrors/sonner`
- `gracefulerrors/internal` for internal testing and low-level integration only

## Configuration Highlights

Common engine options include:

- `registry`: typed error-to-UI mapping
- `fallback`: default UI choice when no registry entry matches
- `normalizer` / `normalizers`: custom normalization pipeline
- `fingerprint`: dedupe key strategy
- `dedupeWindow`: deduplication window in milliseconds
- `maxConcurrent` and `maxQueue`: notification throughput control
- `aggregation`: group bursts of the same UI type
- `routingStrategy`: dynamic override before registry resolution
- `transform`: post-normalization shaping or suppression
- `onError`, `onNormalized`, `onRouted`, `onFallback`, `onSuppressed`, `onDropped`: lifecycle hooks
- `renderer`: custom rendering adapter

## Package Notes

- Package format: ESM and CJS via conditional exports
- Runtime peers: `react`, `react-dom`, and `sonner` are optional peer dependencies
- Current version: `0.1.0`

## Development

```bash
npm run build
npm run lint
npm run typecheck
```

## License

MIT