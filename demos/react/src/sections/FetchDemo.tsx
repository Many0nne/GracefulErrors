import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'
import { createFetch } from 'gracefulerrors'

export default function FetchDemo() {
  const engine = useErrorEngine()
  const [log, setLog] = useState<Array<{ label: string; url: string; mode: string; outcome: string }>>([])

  const addLog = (label: string, url: string, mode: string, outcome: string) => {
    setLog(prev => [{ label, url, mode, outcome }, ...prev.slice(0, 4)])
  }

  const runFetch = async (url: string, mode: 'throw' | 'handle' | 'silent', label: string) => {
    if (!engine) return
    const fetchWrapper = createFetch(engine, { mode })
    try {
      const res = await fetchWrapper(url)
      addLog(label, url, mode, res ? `OK ${res.status}` : 'undefined (error handled)')
    } catch (e) {
      addLog(label, url, mode, `thrown: ${e instanceof Response ? `Response(${e.status})` : String(e)}`)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime-600 bg-lime-50 border border-lime-200 px-2.5 py-0.5 rounded-full mb-2">
          createFetch
        </span>
        <h2 className="text-xl font-bold text-slate-900">createFetch Wrapper</h2>
        <p className="text-slate-500 text-sm mt-1">
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">createFetch(engine, {'{ mode }'})</code>{' '}
          wraps the native <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">fetch</code> and
          automatically forwards HTTP errors to the engine. Three modes control behavior after engine.handle():
        </p>
        <ul className="mt-2 text-sm text-slate-500 space-y-0.5 list-disc list-inside">
          <li><strong>throw</strong> — calls engine.handle(), then re-throws</li>
          <li><strong>handle</strong> — calls engine.handle(), returns undefined</li>
          <li><strong>silent</strong> — returns the raw Response, does not call engine.handle()</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-xs">
        {(['throw', 'handle', 'silent'] as const).map(mode => (
          <div
            key={mode}
            className="border border-slate-200 rounded-lg p-3 bg-white"
          >
            <p className="font-semibold text-slate-700 mb-2 capitalize">Mode: {mode}</p>
            <div className="space-y-2">
              <button
                onClick={() => runFetch('https://httpstat.us/404', mode, `404 (${mode})`)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                GET /404
              </button>
              <button
                onClick={() => runFetch('https://httpstat.us/500', mode, `500 (${mode})`)}
                className="w-full bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                GET /500
              </button>
              <button
                onClick={() => runFetch('https://httpstat.us/200', mode, `200 (${mode})`)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                GET /200 (success)
              </button>
            </div>
          </div>
        ))}
      </div>

      {log.length > 0 && (
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Request</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Mode</th>
                <th className="text-left px-3 py-2 font-semibold text-slate-600">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {log.map((entry, i) => (
                <tr key={i} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-mono text-slate-700">{entry.label}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                      entry.mode === 'throw' ? 'bg-red-100 text-red-700' :
                      entry.mode === 'handle' ? 'bg-sky-100 text-sky-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {entry.mode}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-600">{entry.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        Note: These requests hit <code className="font-mono">httpstat.us</code> which returns mock HTTP status codes.
        If the request fails due to CORS or network issues, the error is still forwarded to the engine.
      </div>

      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        const fetchWithEngine = createFetch(engine, {'{ mode: "handle" }'})<br />
        await fetchWithEngine('/api/resource')<br />
        <span className="text-slate-400">// 4xx/5xx → engine.handle() called automatically</span>
      </div>
    </div>
  )
}
