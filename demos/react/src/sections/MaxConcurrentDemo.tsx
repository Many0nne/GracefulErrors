import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'

const CODES = [
  'AUTH_EXPIRED',
  'AUTH_FORBIDDEN',
  'NETWORK_OFFLINE',
  'NETWORK_TIMEOUT',
  'SERVER_ERROR',
  'RATE_LIMITED',
]

export default function MaxConcurrentDemo() {
  const engine = useErrorEngine()
  const [log, setLog] = useState<Array<{ code: string; result: string; placement: string }>>([])

  const fireAll = () => {
    setLog([])
    const results = CODES.map(code => {
      const result = engine?.handle({ code })
      return {
        code,
        result: result?.handled ? 'handled' : 'dropped/dedupe',
        placement: result?.handled ? (result.uiAction ?? 'silent') : 'rejected',
      }
    })
    setLog(results)
  }

  const fireBurst = async () => {
    setLog([])
    const results: typeof log = []
    for (const code of CODES) {
      const result = engine?.handle({ code })
      results.push({
        code,
        result: result?.handled ? 'handled' : 'dropped',
        placement: result?.handled ? (result.uiAction ?? 'silent') : 'queued/rejected',
      })
      // Small gap to avoid dedupe (since these are different codes, they won't dedupe,
      // but we want to show queue behavior)
      await new Promise(r => setTimeout(r, 10))
    }
    setLog(results)
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full mb-2">
          maxConcurrent + maxQueue
        </span>
        <h2 className="text-xl font-bold text-slate-900">Max Concurrent &amp; Queue</h2>
        <p className="text-slate-500 text-sm mt-1">
          The engine limits simultaneous active errors via{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">maxConcurrent: 4</code>.
          Errors beyond the limit are queued (up to{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">maxQueue: 10</code>) and
          promoted when a slot opens. When the queue overflows,{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">onDropped</code> fires
          with <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">reason: 'queue_overflow'</code>.
        </p>
      </div>

      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-mono mb-4">
        <span className="text-indigo-700 font-semibold">Engine config:</span>{' '}
        <span className="text-slate-600">maxConcurrent: 4, maxQueue: 10</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={fireAll}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire {CODES.length} errors at once (max 4 active)
        </button>
        <button
          onClick={fireBurst}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire rapidly (10ms apart)
        </button>
        <button
          onClick={() => engine?.clearAll()}
          className="bg-white hover:bg-slate-50 text-slate-700 text-sm px-4 py-2 rounded-lg font-medium border border-slate-300 transition-colors"
        >
          Clear all (frees slots)
        </button>
      </div>

      {log.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-3 py-2 font-semibold text-slate-600 rounded-tl-lg">Error Code</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Result</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600 rounded-tr-lg">UI Action</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-mono text-slate-700">{entry.code}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      entry.result === 'handled' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {entry.result}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-500">{entry.placement}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        createErrorEngine({'{ maxConcurrent: 4, maxQueue: 10, ... }'})<br />
        <span className="text-slate-400">// onDropped: (error, reason) fires when queue overflows</span>
      </div>
    </div>
  )
}
