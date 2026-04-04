import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'

export default function SilentDemo() {
  const engine = useErrorEngine()
  const [lastResult, setLastResult] = useState<string | null>(null)

  const fire = (code: string) => {
    const result = engine?.handle({ code })
    setLastResult(JSON.stringify(result, null, 2))
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full mb-2">
          ui: 'silent'
        </span>
        <h2 className="text-xl font-bold text-slate-900">Silent Errors</h2>
        <p className="text-slate-500 text-sm mt-1">
          Silent errors are processed and routed through all lifecycle hooks (
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">onError</code>,{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">onNormalized</code>,{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">onRouted</code>) but
          produce no UI. They appear in the event log with{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">uiAction: null</code>.
          Useful for analytics failures, background prefetch errors, etc.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <button
          onClick={() => fire('ANALYTICS_FAIL')}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Analytics failure (silent)
        </button>
        <button
          onClick={() => fire('PREFETCH_FAIL')}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Prefetch failure (silent)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
          <p className="font-semibold text-amber-700 mb-1">What happens</p>
          <ul className="text-slate-600 space-y-0.5 list-disc list-inside">
            <li>onError fires</li>
            <li>onNormalized fires</li>
            <li>onRouted fires (action = silent)</li>
            <li>No toast, modal, or inline shown</li>
            <li>ERROR_ADDED event with action: "silent"</li>
          </ul>
        </div>

        {lastResult && (
          <div className="p-3 bg-slate-900 rounded-lg text-xs font-mono">
            <p className="text-slate-400 mb-1">handle() return value:</p>
            <pre className="text-green-400 whitespace-pre-wrap break-all">{lastResult}</pre>
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        <span className="text-slate-400">// Registry entry:</span><br />
        ANALYTICS_FAIL: {'{ ui: "silent" }'}<br />
        <span className="text-slate-400">// handle() returns:</span><br />
        {'{ handled: true, error: {...}, uiAction: null }'}
      </div>
    </div>
  )
}
