# Examples

Runnable Vite apps that show how to wire up `gracefulerrors` in a real project.

| Directory            | Stack           | Adapter                 |
| -------------------- | --------------- | ----------------------- |
| [`react/`](./react/) | Vite + React 18 | Sonner                  |
| [`vue/`](./vue/)     | Vite + Vue 3    | Sonner (via vue-sonner) |

Each example demonstrates:

- engine creation with the HTTP preset (`createHttpPreset`)
- `createFetch` — a drop-in `fetch` wrapper that forwards errors to the engine
- toast / modal notifications triggered by real HTTP error responses

## Prerequisites

Build the library once before running the examples (they reference the package
via a local `file:../..` path):

```bash
# from the repo root
npm install
npm run build
```

## Running an example

```bash
cd examples/react   # or examples/vue
npm install
npm run dev
```

Then open <http://localhost:5173> and click the buttons to trigger errors.

## Key files

### React

| File            | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `src/engine.ts` | Creates the engine with HTTP preset + Sonner adapter    |
| `src/main.tsx`  | Mounts `<ErrorEngineProvider>` and `<SonnerToaster>`    |
| `src/App.tsx`   | Uses `useErrorEngine` + `createFetch` to trigger errors |

### Vue

| File            | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `src/engine.ts` | Creates the engine with HTTP preset + Sonner adapter    |
| `src/main.ts`   | Installs `createErrorEnginePlugin` on the Vue app       |
| `src/App.vue`   | Uses `useErrorEngine` + `createFetch` to trigger errors |
