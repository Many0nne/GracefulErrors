<script setup lang="ts">
import { engine } from '../engine'

function trigger(code: string) {
  engine.handle({ code })
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-purple);" />
      <h2 class="section-title">Modal Dialogs</h2>
      <span class="badge badge-purple">ui: 'modal'</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      Blocking overlays for critical or actionable errors. Can be dismissible or non-dismissible.
      The <code style="color: var(--accent-cyan); font-size: 11px;">onDismiss</code> callback releases the engine slot automatically.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      <button class="btn btn-danger" @click="trigger('AUTH_FORBIDDEN')">
        <span>⊘</span> Dismissible (sm)
      </button>
      <button class="btn btn-warning" @click="trigger('SYS_MAINTENANCE')">
        <span>⚙</span> Maintenance (md)
      </button>
      <button class="btn btn-purple" @click="trigger('PAYMENT_DECLINED')">
        <span>💳</span> Payment declined (md)
      </button>
      <button class="btn btn-ghost btn-danger" @click="trigger('PAYMENT_FRAUD_DETECTED')" style="border-color: var(--accent-red); color: var(--accent-red);">
        <span>🔒</span> Fraud — non-dismissible (lg)
      </button>
      <button class="btn btn-ghost" @click="trigger('SYS_CRITICAL')">
        <span>☢</span> Critical — non-dismissible (lg)
      </button>
      <button class="btn btn-ghost" @click="trigger('NETWORK_OFFLINE')">
        <span>⊝</span> Offline (sm, non-dismissible)
      </button>
    </div>

    <div style="margin-top: 14px;" class="code-block">registry entry: { ui: 'modal', uiOptions: { dismissible: false, size: 'lg' } }</div>
  </div>
</template>
