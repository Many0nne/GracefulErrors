import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'
import { createErrorEngine } from 'gracefulerrors'
import { createSonnerAdapter } from 'gracefulerrors/sonner'

// A separate engine with debug: true so console traces are visible
const debugEngine = createErrorEngine({
  registry: {
    DEBUG_TOAST: {
      ui: 'toast',
      message: 'Debug trace toast — check the browser console!',
      uiOptions: { severity: 'info', duration: 4000 },
    },
    DEBUG_SILENT: {
      ui: 'silent',
    },
  },
  fallback: { ui: 'toast', message: 'Fallback (debug engine)' },
  debug: { trace: true },
  renderer: createSonnerAdapter(),
})

export default function DebugDemo() {
  const engine = useErrorEngine()
  const [traceVisible, setTraceVisible] = useState(false)
  const [trace, setTrace] = useState('')

  // Monkey-patch console.log to capture traces for display
  const fireDebug = (code: string) => {
    const lines: string[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => {
      lines.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '))
      origLog(...args)
    }
    debugEngine.handle({ code })
    console.log = origLog
    if (lines.length) {
      setTrace(lines.join('\n'))
      setTraceVisible(true)
    }
  }

  const fireGlobal = () => {
    // Show debug on the main engine (debug: true in engine.ts)
    engine?.handle({ code: 'AUTH_EXPIRED' })
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full mb-2">
          debug
        </span>
        <h2 className="text-xl font-bold text-slate-900">Debug Mode</h2>
        <p className="text-slate-500 text-sm mt-1">
          Setting <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">debug: true</code> or{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">debug: {'{ trace: true }'}</code>{' '}
          emits a trace object to the console for every{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">engine.handle()</code> call,
          showing the full pipeline: raw input, normalized error, resolved registry entry, action, and placement.
          This panel captures and displays the trace in-browser.
        </p>
      </div>

      <div className="p-3 bg-slate-800 rounded-lg text-xs font-mono mb-4">
        <span className="text-slate-400">// Enable debug mode:</span><br />
        <span className="text-green-400">createErrorEngine({'{ debug: { trace: true }, ... }'})</span><br />
        <span className="text-slate-400">// Or simply:</span><br />
        <span className="text-green-400">createErrorEngine({'{ debug: true, ... }'})</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={() => fireDebug('DEBUG_TOAST')}
          className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire DEBUG_TOAST (trace engine)
        </button>
        <button
          onClick={() => fireDebug('DEBUG_SILENT')}
          className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire DEBUG_SILENT (trace engine)
        </button>
        <button
          onClick={() => fireDebug('UNKNOWN_IN_DEBUG_ENGINE')}
          className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire unknown code (fallback trace)
        </button>
        <button
          onClick={fireGlobal}
          className="bg-sky-700 hover:bg-sky-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire on global engine (debug: true in engine.ts)
        </button>
      </div>

      {traceVisible && trace && (
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              [gracefulerrors trace] output captured
            </p>
            <button
              onClick={() => setTraceVisible(false)}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              dismiss
            </button>
          </div>
          <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
            {trace}
          </pre>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="font-semibold text-slate-700 mb-1">Trace fields</p>
          <ul className="text-slate-500 space-y-0.5 list-disc list-inside">
            <li><code>raw</code> — original input</li>
            <li><code>normalized</code> — AppError after pipeline</li>
            <li><code>action</code> — resolved UIAction</li>
            <li><code>entry</code> — registry entry (or undefined)</li>
            <li><code>placement</code> — active | queued | rejected</li>
          </ul>
        </div>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="font-semibold text-amber-700 mb-1">Production note</p>
          <p className="text-slate-600">
            Debug traces are suppressed in production builds
            (<code className="font-mono">NODE_ENV === "production"</code>). Safe to leave in engine config.
          </p>
        </div>
      </div>
    </div>
  )
}
