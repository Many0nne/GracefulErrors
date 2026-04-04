import { useState } from 'react'
import { useErrorEngine } from 'gracefulerrors/react'
import { useFieldError } from 'gracefulerrors/react'

function FieldInput({
  label,
  field,
  type = 'text',
  placeholder,
}: {
  label: string
  field: string
  type?: string
  placeholder?: string
}) {
  const { error } = useFieldError(field)
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className={`border rounded-lg px-3 py-2 text-sm outline-none transition-all ${
          error
            ? 'border-red-400 bg-red-50 focus:ring-2 focus:ring-red-300'
            : 'border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-200'
        }`}
      />
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1 animate-pulse">
          <span>⚠</span> {error.message}
        </p>
      )}
    </div>
  )
}

export default function InlineDemo() {
  const engine = useErrorEngine()
  const [submitted, setSubmitted] = useState(false)

  const triggerValidation = () => {
    setSubmitted(true)
    engine?.handle({ code: 'FORM_EMAIL_INVALID', context: { field: 'email' } })
    engine?.handle({ code: 'FORM_PASSWORD_TOO_SHORT', context: { field: 'password' } })
    engine?.handle({ code: 'FORM_REQUIRED', context: { field: 'username' } })
  }

  const triggerSingle = (field: string, code: string) => {
    engine?.handle({ code, context: { field } })
  }

  const clearField = (code: string) => {
    engine?.clear(code as Parameters<typeof engine.clear>[0])
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full mb-2">
          ui: 'inline'
        </span>
        <h2 className="text-xl font-bold text-slate-900">Inline Field Errors</h2>
        <p className="text-slate-500 text-sm mt-1">
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">useFieldError(field)</code>{' '}
          subscribes to inline errors for a specific field. The engine routes errors with{' '}
          <code className="bg-slate-100 text-slate-700 px-1 rounded text-xs">context.field</code> to the
          matching hook automatically.
        </p>
      </div>

      <div className="max-w-sm space-y-4">
        <FieldInput label="Username" field="username" placeholder="Enter username" />
        <FieldInput label="Email" field="email" type="email" placeholder="you@example.com" />
        <FieldInput label="Password" field="password" type="password" placeholder="••••••••" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={triggerValidation}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Simulate Form Validation (all fields)
        </button>
        <button
          onClick={() => triggerSingle('email', 'FORM_EMAIL_INVALID')}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Email error only
        </button>
        <button
          onClick={() => triggerSingle('password', 'FORM_PASSWORD_TOO_SHORT')}
          className="bg-slate-700 hover:bg-slate-800 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors"
        >
          Password error only
        </button>
        {submitted && (
          <button
            onClick={() => {
              clearField('FORM_EMAIL_INVALID')
              clearField('FORM_PASSWORD_TOO_SHORT')
              clearField('FORM_REQUIRED')
              setSubmitted(false)
            }}
            className="bg-white hover:bg-slate-50 text-slate-700 text-sm px-4 py-2 rounded-lg font-medium border border-slate-300 transition-colors"
          >
            Clear all field errors
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 font-mono">
        <span className="text-slate-400">// In your component:</span><br />
        const {'{ error }'} = useFieldError('email')<br />
        <span className="text-slate-400">// Trigger:</span><br />
        engine.handle({'{ code: "FORM_EMAIL_INVALID", context: { field: "email" } }'})
      </div>
    </div>
  )
}
