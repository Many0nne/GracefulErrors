import { useState } from 'react'
import { ErrorBoundaryWithEngine } from 'gracefulerrors/react'

// A component that throws on demand
function BombComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('BombComponent detonated! This render error was caught by ErrorBoundaryWithEngine.')
  }
  return (
    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
      Component is rendering normally. Click "Trigger Crash" to detonate it.
    </div>
  )
}

export default function BoundaryDemo() {
  const [shouldThrow, setShouldThrow] = useState(false)
  const [key, setKey] = useState(0)

  const reset = () => {
    setShouldThrow(false)
    setKey(k => k + 1)
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full mb-2">
          ErrorBoundaryWithEngine
        </span>
        <h2 className="text-xl font-bold text-slate-900">Error Boundary</h2>
        <p className="text-slate-500 text-sm mt-1">
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">ErrorBoundaryWithEngine</code>{' '}
          extends React's standard error boundary and forwards caught render errors to the engine via{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">engine.handle(error)</code>.
          The engine normalizes the <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">Error</code> object
          and routes it (fallback toast in this demo).
        </p>
      </div>

      <div className="mb-4">
        <ErrorBoundaryWithEngine
          key={key}
          fallback={
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-lg">
              <p className="text-rose-700 font-semibold text-sm mb-1">Component crashed</p>
              <p className="text-rose-600 text-xs mb-3">
                The error has been forwarded to the engine. Check the event log for onError, onNormalized, and onRouted events.
              </p>
              <button
                onClick={reset}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Reset boundary
              </button>
            </div>
          }
        >
          <BombComponent shouldThrow={shouldThrow} />
        </ErrorBoundaryWithEngine>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setShouldThrow(true)}
          disabled={shouldThrow}
          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Trigger Crash
        </button>
        {shouldThrow && (
          <button
            onClick={reset}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        <pre className="whitespace-pre-wrap">{`<ErrorBoundaryWithEngine
  fallback={<div>Something went wrong</div>}
>
  <MyComponent />
</ErrorBoundaryWithEngine>
// When MyComponent throws, the Error is forwarded to engine.handle(error)`}</pre>
      </div>
    </div>
  )
}
