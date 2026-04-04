import { reactive } from 'vue'
import type { RendererAdapter, RenderIntent } from 'gracefulerrors'

export interface ToastItem {
  id: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'success'
  code: string
  duration: number
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'
  leaving: boolean
  icon?: string
}

export interface ModalItem {
  code: string
  message: string
  title: string
  dismissible: boolean
  size: 'sm' | 'md' | 'lg'
  onDismiss: () => void
}

export const toasts = reactive<ToastItem[]>([])
export const modal = reactive<{ active: ModalItem | null }>({ active: null })

let idCounter = 0

function getSeverityFromCode(code: string): ToastItem['severity'] {
  const lower = code.toLowerCase()
  if (lower.includes('warn') || lower.includes('rate') || lower.includes('timeout')) return 'warning'
  if (lower.includes('success') || lower.includes('ok') || lower.includes('created')) return 'success'
  if (lower.includes('info') || lower.includes('debug')) return 'info'
  return 'error'
}

function formatMessage(intent: RenderIntent): string {
  const { entry, error } = intent
  if (!entry.message) {
    return error.message ?? `Error: ${String(error.code)}`
  }
  if (typeof entry.message === 'function') {
    return entry.message(error)
  }
  return entry.message
}

export function createVueRenderer(): RendererAdapter {
  return {
    render(intent: RenderIntent, lifecycle: { onDismiss?: () => void }): void {
      const { ui, entry, error } = intent

      const rawMessage = formatMessage(intent)

      if (ui === 'toast') {
        const opts = entry.ui === 'toast' ? (entry.uiOptions ?? {}) : {}
        const toastOpts = opts as {
          position?: ToastItem['position']
          severity?: ToastItem['severity']
          icon?: string
          duration?: number
        }

        const item: ToastItem = {
          id: `toast-${++idCounter}`,
          message: rawMessage,
          severity: toastOpts.severity ?? getSeverityFromCode(String(error.code)),
          code: String(error.code),
          duration: toastOpts.duration ?? entry.ttl ?? 4000,
          position: toastOpts.position ?? 'top-right',
          leaving: false,
          icon: toastOpts.icon,
        }

        toasts.push(item)

        setTimeout(() => {
          const idx = toasts.findIndex((t) => t.id === item.id)
          if (idx !== -1) {
            toasts[idx].leaving = true
            setTimeout(() => {
              const i = toasts.findIndex((t) => t.id === item.id)
              if (i !== -1) toasts.splice(i, 1)
            }, 220)
          }
        }, item.duration)
      } else if (ui === 'modal') {
        const opts = entry.ui === 'modal' ? (entry.uiOptions ?? {}) : {}
        const modalOpts = opts as { dismissible?: boolean; size?: 'sm' | 'md' | 'lg' }

        modal.active = {
          code: String(error.code),
          message: rawMessage,
          title: `Error — ${String(error.code)}`,
          dismissible: modalOpts.dismissible ?? true,
          size: modalOpts.size ?? 'md',
          onDismiss: () => {
            modal.active = null
            lifecycle.onDismiss?.()
          },
        }
      }
    },

    clear(code: string): void {
      // Remove toasts for this code
      const indices: number[] = []
      toasts.forEach((t, i) => { if (t.code === code) indices.push(i) })
      for (let i = indices.length - 1; i >= 0; i--) toasts.splice(indices[i], 1)

      // Clear modal if it matches
      if (modal.active?.code === code) {
        modal.active = null
      }
    },

    clearAll(): void {
      toasts.splice(0, toasts.length)
      modal.active = null
    },
  }
}
