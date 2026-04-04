<script setup lang="ts">
import { computed } from 'vue'
import { toasts } from '../renderer'

type Position =
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  | 'top-center' | 'bottom-center'

const positions: Position[] = [
  'top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center',
]

const byPosition = computed(() => {
  const map: Record<string, typeof toasts> = {}
  for (const pos of positions) {
    const filtered = toasts.filter((t) => t.position === pos)
    if (filtered.length > 0) map[pos] = filtered
  }
  return map
})

function positionStyle(pos: Position): Record<string, string> {
  const base: Record<string, string> = {
    position: 'fixed',
    zIndex: '9999',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '380px',
    width: '100%',
    pointerEvents: 'none',
  }
  if (pos.includes('top')) base.top = '20px'
  else base.bottom = '20px'
  if (pos.includes('right')) base.right = '20px'
  else if (pos.includes('left')) base.left = '20px'
  else { base.left = '50%'; base.transform = 'translateX(-50%)' }
  return base
}

const severityConfig = {
  error: {
    accent: '#ff4466',
    bg: 'rgba(255, 68, 102, 0.08)',
    border: 'rgba(255, 68, 102, 0.3)',
    icon: '✕',
    glow: 'rgba(255, 68, 102, 0.2)',
  },
  warning: {
    accent: '#ffd700',
    bg: 'rgba(255, 215, 0, 0.07)',
    border: 'rgba(255, 215, 0, 0.25)',
    icon: '⚠',
    glow: 'rgba(255, 215, 0, 0.15)',
  },
  info: {
    accent: '#4d9fff',
    bg: 'rgba(77, 159, 255, 0.07)',
    border: 'rgba(77, 159, 255, 0.25)',
    icon: 'ℹ',
    glow: 'rgba(77, 159, 255, 0.15)',
  },
  success: {
    accent: '#00ff88',
    bg: 'rgba(0, 255, 136, 0.06)',
    border: 'rgba(0, 255, 136, 0.2)',
    icon: '✓',
    glow: 'rgba(0, 255, 136, 0.15)',
  },
}

function removeToast(id: string) {
  const idx = toasts.findIndex((t) => t.id === id)
  if (idx !== -1) {
    toasts[idx].leaving = true
    setTimeout(() => {
      const i = toasts.findIndex((t) => t.id === id)
      if (i !== -1) toasts.splice(i, 1)
    }, 220)
  }
}
</script>

<template>
  <div v-for="(items, pos) in byPosition" :key="pos" :style="positionStyle(pos as Position)">
    <div
      v-for="toast in items"
      :key="toast.id"
      :class="toast.leaving ? 'toast-leave' : 'toast-enter'"
      :style="{
        pointerEvents: 'all',
        background: severityConfig[toast.severity].bg,
        border: `1px solid ${severityConfig[toast.severity].border}`,
        borderLeft: `3px solid ${severityConfig[toast.severity].accent}`,
        borderRadius: '6px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        backdropFilter: 'blur(12px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03), 0 2px 16px ${severityConfig[toast.severity].glow}`,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }"
      @click="removeToast(toast.id)"
    >
      <!-- Icon -->
      <div :style="{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: severityConfig[toast.severity].accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        fontWeight: '700',
        color: '#000',
        flexShrink: '0',
        marginTop: '1px',
      }">
        {{ toast.icon || severityConfig[toast.severity].icon }}
      </div>

      <!-- Content -->
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 3px; opacity: 0.6; font-family: 'JetBrains Mono', monospace;">
          {{ toast.code }}
        </div>
        <div style="font-size: 12px; color: #e0e0f5; line-height: 1.5; font-family: 'JetBrains Mono', monospace;">
          {{ toast.message }}
        </div>
      </div>

      <!-- Close hint -->
      <div style="font-size: 10px; opacity: 0.3; flex-shrink: 0; padding-top: 2px; font-family: 'JetBrains Mono', monospace;">✕</div>

      <!-- Progress bar -->
      <div :style="{
        position: 'absolute',
        bottom: '0',
        left: '0',
        height: '2px',
        background: severityConfig[toast.severity].accent,
        opacity: '0.5',
        animation: `progress-shrink ${toast.duration}ms linear forwards`,
      }" />
    </div>
  </div>
</template>
