import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'

export default function FallbackDemo() {
  const engine = useErrorEngine()
  const [results, setResults] = useState<Array<{ code: string; result: string }>>([])

  const fire = (code: string) => {
    const result = engine?.handle({ code })
    setResults(prev => [
      { code, result: JSON.stringify(result, null, 2) },
      ...prev.slice(0, 2),
    ])
  }

  const fireError = () => {
    const result = engine?.handle(new Error('Unregistered native Error'))
    setResults(prev => [
      { code: 'Error object', result: JSON.stringify(result, null, 2) },
      ...prev.slice(0, 2),
    ])
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full mb-2">
          fallback
        </span>
        <h2 className="text-xl font-bold text-slate-900">Fallback Behavior</h2>
        <p className="text-slate-500 text-sm mt-1">
          When an error code has no registry entry, the engine uses the configured{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">fallback</code> action
          and message. The <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">onFallback</code>{' '}
          callback fires. These buttons send unknown codes or raw{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">Error</code> objects.
        </p>
      </div>

      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs font-mono mb-4">
        <span className="text-orange-700 font-semibold">Engine fallback config:</span><br />
        <span className="text-slate-600">fallback: {'{ ui: "toast", message: "An unexpected error occurred." }'}</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={() => fire('UNKNOWN_CODE_XYZ')}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Unknown code: UNKNOWN_CODE_XYZ
        </button>
        <button
          onClick={() => fire('MY_APP_ERROR_99')}
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Unknown code: MY_APP_ERROR_99
        </button>
        <button
          onClick={fireError}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Raw Error object (no code)
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last results</p>
          {results.map((r, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-3 text-xs font-mono">
              <p className="text-slate-400 mb-1">input: <span className="text-yellow-300">{r.code}</span></p>
              <pre className="text-green-400 whitespace-pre-wrap">{r.result}</pre>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        <span className="text-slate-400">// onFallback fires when no registry entry found</span><br />
        onFallback: (error) =&gt; console.log('Fallback triggered for', error.code)
      </div>
    </div>
  )
}
