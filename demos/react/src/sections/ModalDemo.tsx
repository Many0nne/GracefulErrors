import { useErrorEngine } from 'gracefulerrors/react'

export default function ModalDemo() {
  const engine = useErrorEngine()

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-0.5 rounded-full mb-2">
          ui: 'modal'
        </span>
        <h2 className="text-xl font-bold text-slate-900">Modal Dialogs</h2>
        <p className="text-slate-500 text-sm mt-1">
          Modals are rendered by the Sonner adapter using a React portal. The{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">dismissible</code>{' '}
          flag controls whether clicking the backdrop or pressing Escape closes the modal.
          Non-dismissible modals force the user to click the button.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          onClick={() => engine?.handle({ code: 'DATA_LOSS_WARNING' })}
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          Dismissible Modal — unsaved changes warning
        </button>
        <button
          onClick={() => engine?.handle({ code: 'SESSION_EXPIRED_MODAL' })}
          className="bg-rose-600 hover:bg-rose-700 text-white text-sm px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          Non-dismissible Modal — session expired
        </button>
        <button
          onClick={() => engine?.handle({ code: 'PAYMENT_DECLINED' })}
          className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          Payment Declined
        </button>
        <button
          onClick={() => engine?.handle({ code: 'PAYMENT_INSUFFICIENT_FUNDS' })}
          className="bg-amber-600 hover:bg-amber-700 text-white text-sm px-4 py-2.5 rounded-lg font-medium transition-colors"
        >
          Insufficient Funds
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
          <p className="font-semibold text-violet-700 mb-1">Dismissible (default)</p>
          <p className="text-slate-600">
            <code className="bg-white px-1 rounded border border-slate-200">uiOptions: {'{ dismissible: true }'}</code><br />
            Click backdrop or press Esc to close.
          </p>
        </div>
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <p className="font-semibold text-rose-700 mb-1">Non-dismissible</p>
          <p className="text-slate-600">
            <code className="bg-white px-1 rounded border border-slate-200">uiOptions: {'{ dismissible: false }'}</code><br />
            Must click the Dismiss button.
          </p>
        </div>
      </div>

      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        engine.handle({'{ code: "DATA_LOSS_WARNING" }'})<br />
        <span className="text-slate-400">// registry entry: {'{ ui: "modal", uiOptions: { dismissible: true, size: "md" } }'}</span>
      </div>
    </div>
  )
}
