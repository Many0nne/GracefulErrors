import { toast, Toaster } from 'sonner'
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import type { RendererAdapter, RenderIntent, ErrorRegistryEntryFull, AppError } from '../types'

function resolveMessage<TCode extends string = string>(entry: ErrorRegistryEntryFull<TCode>, error: AppError<TCode>): string | undefined {
  if (typeof entry.message === 'function') return entry.message(error)
  return entry.message
}

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

function ModalDialog({
  message,
  dismissible,
  onDismiss,
}: {
  message: string
  dismissible: boolean
  onDismiss: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onDismiss])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={dismissible ? onDismiss : undefined}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          padding: 24,
          minWidth: 300,
          maxWidth: 500,
        }}
        onClick={e => e.stopPropagation()}
      >
        <p style={{ margin: '0 0 16px' }}>{message}</p>
        <button onClick={onDismiss}>Dismiss</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// createSonnerAdapter
// ---------------------------------------------------------------------------

export function createSonnerAdapter(): RendererAdapter {
  const activeToastIds = new Map<string, string | number>()

  function render<TCode extends string = string>(intent: RenderIntent<TCode>, lifecycle: { onDismiss?: () => void }): void {
    switch (intent.ui) {
      case 'toast': {
        const message =
          resolveMessage(intent.entry, intent.error) ??
          intent.error.message ??
          'An error occurred'

        type ToastOpts = {
          position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
          severity?: 'info' | 'warning' | 'error' | 'success'
          icon?: string
          duration?: number
        }
        const opts = (intent.entry.uiOptions ?? {}) as ToastOpts
        const severity = opts.severity ?? 'error'

        const severityMap: Record<string, typeof toast.error> = {
          error: toast.error,
          warning: toast.warning,
          info: toast.info,
          success: toast.success,
        }
        const toastFn = severityMap[severity] ?? toast.error

        const id = toastFn(message, {
          position: opts.position ?? 'top-right',
          icon: opts.icon,
          duration: opts.duration ?? 4000,
        })

        activeToastIds.set(intent.error.code as string, id)
        break
      }

      case 'modal': {
        const message =
          resolveMessage(intent.entry, intent.error) ??
          intent.error.message ??
          'An error occurred'
        const opts = intent.entry.uiOptions ?? {}
        const dismissible = (opts as { dismissible?: boolean }).dismissible !== false

        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)

        const dismiss = () => {
          root.unmount()
          if (document.body.contains(container)) {
            document.body.removeChild(container)
          }
          lifecycle.onDismiss?.()
        }

        root.render(
          <ModalDialog message={message} dismissible={dismissible} onDismiss={dismiss} />
        )
        break
      }

      case 'inline':
        return

      case 'silent':
        return
    }
  }

  function clear(code: string): void {
    const id = activeToastIds.get(code)
    if (id !== undefined) {
      toast.dismiss(id)
      activeToastIds.delete(code)
    }
  }

  function clearAll(): void {
    toast.dismiss()
    activeToastIds.clear()
  }

  return { render, clear, clearAll }
}

export { Toaster as SonnerToaster }
