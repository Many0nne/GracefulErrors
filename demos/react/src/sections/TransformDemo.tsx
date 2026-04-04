import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'

export default function TransformDemo() {
  const engine = useErrorEngine()
  const [results, setResults] = useState<Array<{ label: string; result: string }>>([])

  const fire = (label: string, code: string, extra?: object) => {
    const result = engine?.handle({ code, ...extra })
    setResults(prev => [
      { label, result: JSON.stringify(result, null, 2) },
      ...prev.slice(0, 2),
    ])
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full mb-2">
          transform
        </span>
        <h2 className="text-xl font-bold text-slate-900">Transform Pipeline</h2>
        <p className="text-slate-500 text-sm mt-1">
          The <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">transform</code>{' '}
          function intercepts normalized errors before routing. It can:
        </p>
        <ul className="mt-2 text-sm text-slate-500 list-disc list-inside space-y-0.5">
          <li>Return a modified <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">AppError</code> to rewrite code/message/context</li>
          <li>Return <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">{'{ suppress: true, reason: "..." }'}</code> to suppress the error entirely</li>
          <li>Return <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">null</code> to pass through unchanged</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs font-mono">
          <p className="text-purple-700 font-semibold mb-1">Transform (rewrite message)</p>
          <pre className="text-slate-600 whitespace-pre-wrap">{`if (error.code === 'TRANSFORM_DEMO') {
  return {
    ...error,
    message: '[Transformed] rewritten!'
  }
}`}</pre>
        </div>
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-mono">
          <p className="text-rose-700 font-semibold mb-1">Suppression</p>
          <pre className="text-slate-600 whitespace-pre-wrap">{`if (error.code === 'TRANSFORM_SUPPRESS_DEMO') {
  return {
    suppress: true,
    reason: 'Demo suppression'
  }
}`}</pre>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={() => fire('Transform (rewrite)', 'TRANSFORM_DEMO')}
          className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire TRANSFORM_DEMO → message rewritten
        </button>
        <button
          onClick={() => fire('Suppression', 'TRANSFORM_SUPPRESS_DEMO')}
          className="bg-rose-600 hover:bg-rose-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire TRANSFORM_SUPPRESS_DEMO → suppressed
        </button>
        <button
          onClick={() => fire('Pass-through (null)', 'AUTH_EXPIRED')}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          AUTH_EXPIRED → transform returns null (pass-through)
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Results</p>
          {results.map((r, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-3 text-xs font-mono">
              <p className="text-slate-400 mb-1">
                <span className="text-yellow-300">{r.label}</span>
              </p>
              <pre className="text-green-400 whitespace-pre-wrap">{r.result}</pre>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Notice: when suppressed, <code className="bg-slate-100 text-slate-700 px-1 rounded">handled: false</code> and
        the event log shows <code className="bg-slate-100 text-slate-700 px-1 rounded">onSuppressed</code>.
      </p>
    </div>
  )
}
