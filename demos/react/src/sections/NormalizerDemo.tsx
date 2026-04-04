import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'

export default function NormalizerDemo() {
  const engine = useErrorEngine()
  const [results, setResults] = useState<Array<{ label: string; input: string; result: string }>>([])

  const fire = (label: string, raw: unknown) => {
    const result = engine?.handle(raw)
    setResults(prev => [
      {
        label,
        input: JSON.stringify(raw, null, 2),
        result: JSON.stringify(result, null, 2),
      },
      ...prev.slice(0, 2),
    ])
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 bg-cyan-50 border border-cyan-200 px-2.5 py-0.5 rounded-full mb-2">
          normalizers
        </span>
        <h2 className="text-xl font-bold text-slate-900">Normalizer Pipeline</h2>
        <p className="text-slate-500 text-sm mt-1">
          The normalizer pipeline converts any raw input into a standardized{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">AppError</code>. This
          demo uses two normalizers chained via{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">normalizers: [demoApiNormalizer, builtInNormalizer]</code>.
          The demo API normalizer handles{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">{'{ errorCode, statusCode, detail }'}</code>{' '}
          shapes; <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">builtInNormalizer</code> handles
          native <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">Error</code>,{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">{'{ code, message }'}</code>, and{' '}
          fetch <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">Response</code>.
        </p>
      </div>

      <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-lg text-xs font-mono mb-4">
        <span className="text-cyan-700 font-semibold">demoApiNormalizer:</span>
        <pre className="text-slate-600 mt-1 whitespace-pre-wrap">{`(raw) => {
  if (raw?.errorCode) {
    return {
      code: raw.errorCode,
      status: raw.statusCode,
      message: raw.detail,
      context: raw.field ? { field: raw.field } : undefined
    }
  }
  return current // pass to next normalizer
}`}</pre>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={() => fire('Custom API shape', {
            errorCode: 'AUTH_FORBIDDEN',
            statusCode: 403,
            detail: 'Access denied to /admin',
          })}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Custom API {'{ errorCode, statusCode, detail }'}
        </button>
        <button
          onClick={() => fire('Custom API with field', {
            errorCode: 'FORM_EMAIL_INVALID',
            statusCode: 422,
            detail: 'Email format is wrong',
            field: 'email',
          })}
          className="bg-cyan-600 hover:bg-cyan-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Custom API + field (inline)
        </button>
        <button
          onClick={() => fire('builtInNormalizer: Error', new Error('Something broke'))}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Native Error object
        </button>
        <button
          onClick={() => fire('builtInNormalizer: plain { code }', { code: 'SERVER_ERROR', status: 500, message: 'DB connection failed' })}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Plain {'{ code, status, message }'}
        </button>
        <button
          onClick={() => fire('builtInNormalizer: string', 'Something went wrong')}
          className="bg-slate-600 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Raw string
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Normalization results</p>
          {results.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800 rounded-lg p-3 text-xs font-mono">
                <p className="text-slate-400 mb-1">input ({r.label})</p>
                <pre className="text-yellow-300 whitespace-pre-wrap">{r.input}</pre>
              </div>
              <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono">
                <p className="text-slate-400 mb-1">handle() result</p>
                <pre className="text-green-400 whitespace-pre-wrap">{r.result}</pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
