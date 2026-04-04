<script setup lang="ts">
import { engine } from '../engine'

function trigger(code: string, extra?: Record<string, unknown>) {
  engine.handle({ code, ...extra })
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-yellow);" />
      <h2 class="section-title">Toast Notifications</h2>
      <span class="badge badge-yellow">ui: 'toast'</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      Floating notifications with severity styles, auto-dismiss timers, and configurable positions.
      Click any toast to dismiss it immediately.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      <button class="btn btn-danger" @click="trigger('NETWORK_SERVER_ERROR')">
        <span>⊗</span> Error toast
      </button>
      <button class="btn btn-warning" @click="trigger('NETWORK_TIMEOUT')">
        <span>⚠</span> Warning toast
      </button>
      <button class="btn btn-info" @click="trigger('AUTH_MFA_REQUIRED')">
        <span>ℹ</span> Info toast (top-center)
      </button>
      <button class="btn btn-success" @click="trigger('SYS_VERSION_MISMATCH')">
        <span>↑</span> Update toast (bottom-center)
      </button>
      <button class="btn btn-orange" @click="trigger('NETWORK_RATE_LIMITED', { context: { retryAfter: 30 } })">
        <span>⏱</span> Dynamic message
      </button>
      <button class="btn btn-ghost" @click="trigger('CART_OUT_OF_STOCK', { context: { item: 'Mechanical Keyboard' } })">
        <span>◻</span> Out of stock (bottom-right)
      </button>
    </div>

    <div style="margin-top: 14px;" class="code-block">registry entry: { ui: 'toast', message: '...', ttl: 4000, uiOptions: { severity: 'error', position: 'top-right' } }</div>
  </div>
</template>
