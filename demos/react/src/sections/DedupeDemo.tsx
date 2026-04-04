import { useState, useRef } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'

export default function DedupeDemo() {
  const engine = useErrorEngine()
  const [stats, setStats] = useState({ fired: 0, shown: 0 })
  const fired = useRef(0)
  const shown = useRef(0)

  const fireRapid = async (count: number) => {
    fired.current = 0
    shown.current = 0
    setStats({ fired: 0, shown: 0 })

    for (let i = 0; i < count; i++) {
      fired.current += 1
      const result = engine?.handle({ code: 'RATE_LIMITED' })
      if (result?.handled) shown.current += 1
      setStats({ fired: fired.current, shown: shown.current })
      // Fire very rapidly — within the 800ms dedupeWindow
      await new Promise(r => setTimeout(r, 50))
    }
  }

  const fireSpaced = async (count: number) => {
    fired.current = 0
    shown.current = 0
    setStats({ fired: 0, shown: 0 })

    for (let i = 0; i < count; i++) {
      fired.current += 1
      const result = engine?.handle({ code: 'RATE_LIMITED' })
      if (result?.handled) shown.current += 1
      setStats({ fired: fired.current, shown: shown.current })
      // Fire spaced out — each beyond the 800ms dedupeWindow
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full mb-2">
          dedupeWindow
        </span>
        <h2 className="text-xl font-bold text-slate-900">Deduplication Window</h2>
        <p className="text-slate-500 text-sm mt-1">
          The engine deduplicates errors with the same fingerprint within a configurable time window.
          This demo uses <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">dedupeWindow: 800ms</code>.
          Rapid-fire calls produce only one toast; spaced calls each produce a toast.
        </p>
      </div>

      <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs font-mono mb-4">
        <span className="text-teal-700 font-semibold">Engine config:</span>{' '}
        <span className="text-slate-600">dedupeWindow: 800  <span className="text-slate-400">// ms</span></span>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <button
          onClick={() => fireRapid(5)}
          className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire 5x rapidly (50ms apart) → expect 1 toast
        </button>
        <button
          onClick={() => fireSpaced(3)}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Fire 3x spaced (1s apart) → expect 3 toasts
        </button>
      </div>

      {(stats.fired > 0) && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-100 rounded-lg p-3">
            <div className="text-2xl font-bold text-slate-800">{stats.fired}</div>
            <div className="text-xs text-slate-500 mt-0.5">engine.handle() calls</div>
          </div>
          <div className="bg-teal-50 rounded-lg p-3 border border-teal-200">
            <div className="text-2xl font-bold text-teal-700">{stats.shown}</div>
            <div className="text-xs text-slate-500 mt-0.5">actually rendered</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
            <div className="text-2xl font-bold text-orange-700">{stats.fired - stats.shown}</div>
            <div className="text-xs text-slate-500 mt-0.5">deduplicated (dropped)</div>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        <span className="text-slate-400">// Fingerprint: code:status:field (default)</span><br />
        createErrorEngine({'{ dedupeWindow: 800, ... }'})
      </div>
    </div>
  )
}
