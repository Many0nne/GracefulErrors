import { useErrorEngine } from 'gracefulerrors/react'

interface ButtonProps {
  onClick: () => void
  children: React.ReactNode
  variant?: 'default' | 'warning' | 'success' | 'info' | 'danger'
}

function Btn({ onClick, children, variant = 'default' }: ButtonProps) {
  const variants = {
    default: 'bg-slate-800 hover:bg-slate-700 text-white',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    info:    'bg-sky-500 hover:bg-sky-600 text-white',
    danger:  'bg-red-500 hover:bg-red-600 text-white',
  }
  return (
    <button
      onClick={onClick}
      className={`${variants[variant]} text-sm px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500`}
    >
      {children}
    </button>
  )
}

export default function ToastDemo() {
  const engine = useErrorEngine()

  const fire = (code: string, extra?: object) =>
    engine?.handle({ code, ...extra })

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full mb-2">
          ui: 'toast'
        </span>
        <h2 className="text-xl font-bold text-slate-900">Toast Notifications</h2>
        <p className="text-slate-500 text-sm mt-1">
          Toasts appear via the Sonner adapter. Each entry in the registry can specify{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">severity</code>,{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">position</code>,{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">icon</code>, and{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">duration</code> via{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">uiOptions</code>.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Btn variant="warning" onClick={() => fire('AUTH_EXPIRED')}>
          ⏱️ Session Expired (warning)
        </Btn>
        <Btn variant="danger" onClick={() => fire('AUTH_FORBIDDEN')}>
          🚫 Forbidden (error)
        </Btn>
        <Btn variant="danger" onClick={() => fire('AUTH_INVALID_CREDENTIALS')}>
          🔑 Invalid Credentials (top-center)
        </Btn>
        <Btn variant="warning" onClick={() => fire('NETWORK_OFFLINE')}>
          📡 Offline (bottom-center)
        </Btn>
        <Btn variant="warning" onClick={() => fire('NETWORK_TIMEOUT')}>
          ⌛ Timeout (warning)
        </Btn>
        <Btn variant="danger" onClick={() => fire('SERVER_ERROR', { status: 503 })}>
          Server Error (dynamic msg)
        </Btn>
        <Btn variant="warning" onClick={() => fire('RATE_LIMITED')}>
          🛑 Rate Limited (short TTL)
        </Btn>
        <Btn
          variant="info"
          onClick={() => engine?.clearAll()}
        >
          Clear All
        </Btn>
      </div>

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        <span className="text-slate-400">// Example</span><br />
        engine.handle({'{ code: "AUTH_EXPIRED" }'})<br />
        <span className="text-slate-400">// With dynamic message:</span><br />
        engine.handle({'{ code: "SERVER_ERROR", status: 503 }'})
      </div>
    </div>
  )
}
