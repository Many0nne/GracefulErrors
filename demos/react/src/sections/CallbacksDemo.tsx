import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'

interface CallbackEvent {
  name: string
  args: string
  time: string
}

export default function CallbacksDemo() {
  const engine = useErrorEngine()
  const [events, setEvents] = useState<CallbackEvent[]>([])

  const push = (name: string, args: unknown) => {
    setEvents(prev => [
      {
        name,
        args: JSON.stringify(args, null, 2).slice(0, 120),
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      },
      ...prev.slice(0, 9),
    ])
  }

  // Create a local engine for just this demo to see callbacks clearly
  // We'll use the global engine but watch for specific patterns
  const scenarios = [
    {
      label: 'onError + onNormalized + onRouted',
      desc: 'Normal flow: all 3 callbacks fire',
      action: () => {
        push('simulated: onError', { raw: '{ code: "AUTH_EXPIRED" }' })
        push('simulated: onNormalized', { code: 'AUTH_EXPIRED', message: 'Your session has expired.' })
        push('simulated: onRouted', { code: 'AUTH_EXPIRED', action: 'toast' })
        engine?.handle({ code: 'AUTH_EXPIRED' })
      },
      color: 'bg-sky-600 hover:bg-sky-700',
    },
    {
      label: 'onSuppressed',
      desc: 'Transform suppresses → onSuppressed fires, no UI',
      action: () => {
        push('simulated: onSuppressed', { code: 'TRANSFORM_SUPPRESS_DEMO', reason: 'Demo suppression' })
        engine?.handle({ code: 'TRANSFORM_SUPPRESS_DEMO' })
      },
      color: 'bg-purple-600 hover:bg-purple-700',
    },
    {
      label: 'onFallback',
      desc: 'Unknown code → onFallback fires, uses fallback UI',
      action: () => {
        push('simulated: onFallback', { code: 'UNKNOWN_CODE', detail: 'No registry entry found' })
        engine?.handle({ code: 'UNKNOWN_XYZ_CODE' })
      },
      color: 'bg-orange-600 hover:bg-orange-700',
    },
    {
      label: 'onDropped (dedupe)',
      desc: 'Rapid-fire same code → onDropped fires for duplicates',
      action: async () => {
        push('simulated: onDropped', { code: 'RATE_LIMITED', reason: 'dedupe' })
        engine?.handle({ code: 'RATE_LIMITED' })
        // immediately fire again to trigger dedupe
        await new Promise(r => setTimeout(r, 10))
        engine?.handle({ code: 'RATE_LIMITED' })
      },
      color: 'bg-red-600 hover:bg-red-700',
    },
    {
      label: 'onNormalized (raw Error)',
      desc: 'Native Error → builtInNormalizer normalizes it',
      action: () => {
        push('simulated: onNormalized', { code: 'GRACEFULERRORS_UNKNOWN', message: 'Something broke' })
        engine?.handle(new Error('Something broke'))
      },
      color: 'bg-amber-600 hover:bg-amber-700',
    },
  ]

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full mb-2">
          lifecycle callbacks
        </span>
        <h2 className="text-xl font-bold text-slate-900">Lifecycle Callbacks</h2>
        <p className="text-slate-500 text-sm mt-1">
          Every step of error processing fires a callback. The global engine's callbacks are wired to
          the live event log sidebar. This panel shows local simulation of what each scenario triggers.
          All callbacks are also visible in the sidebar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        {scenarios.map((s, i) => (
          <button
            key={i}
            onClick={s.action}
            className={`${s.color} text-white text-sm px-4 py-3 rounded-lg font-medium transition-colors text-left`}
          >
            <div className="font-semibold">{s.label}</div>
            <div className="text-xs opacity-80 mt-0.5">{s.desc}</div>
          </button>
        ))}
      </div>

      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono mb-4">
        <span className="text-slate-500 font-sans font-semibold">Callback summary:</span>
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-600">
          <div><span className="text-red-500">onError</span>(raw) — always first</div>
          <div><span className="text-yellow-600">onNormalized</span>(error) — after normalize</div>
          <div><span className="text-green-600">onRouted</span>(error, action) — after routing</div>
          <div><span className="text-purple-600">onSuppressed</span>(error, reason) — if suppressed</div>
          <div><span className="text-orange-500">onFallback</span>(error) — no registry entry</div>
          <div><span className="text-red-700">onDropped</span>(error, reason) — dedupe/overflow</div>
        </div>
      </div>

      {events.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Simulated callback sequence</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {events.map((e, i) => (
              <div key={i} className="bg-slate-900 rounded px-3 py-1.5 text-xs font-mono flex items-start gap-2">
                <span className="text-slate-600 shrink-0">{e.time}</span>
                <span className="text-yellow-300 shrink-0">{e.name}</span>
                <span className="text-slate-400 truncate">{e.args}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
