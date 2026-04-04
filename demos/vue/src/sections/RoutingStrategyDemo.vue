<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, builtInNormalizer } from 'gracefulerrors'
import type { RoutingStrategy } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

// Custom routing strategy: downgrade all modals to toasts when queue is busy
const adaptiveStrategy: RoutingStrategy = (error, registryEntry, context) => {
  const natural = registryEntry?.ui ?? 'toast'
  // If there are already 2+ active errors, downgrade modals to toasts
  if (natural === 'modal' && context.activeCount >= 2) {
    return 'toast'
  }
  return natural
}

const strategyEngine = createErrorEngine({
  registry: {
    STRAT_MODAL: { ui: 'modal', message: 'Modal (may downgrade to toast if busy)', uiOptions: { dismissible: true, size: 'sm' } },
    STRAT_TOAST_A: { ui: 'toast', message: 'Toast A — active slot', ttl: 10000, uiOptions: { severity: 'warning' } },
    STRAT_TOAST_B: { ui: 'toast', message: 'Toast B — active slot', ttl: 10000, uiOptions: { severity: 'info' } },
  },
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
  routingStrategy: adaptiveStrategy,
  dedupeWindow: 0,
  maxConcurrent: 5,
})

const log = ref<Array<{ id: number; code: string; action: string | null; note: string }>>([])
let ctr = 0

function fire(code: string) {
  const r = strategyEngine.handle({ code })
  const registryUi = code === 'STRAT_MODAL' ? 'modal' : 'toast'
  const note = r.uiAction !== registryUi ? `↓ downgraded from ${registryUi}` : 'natural route'
  log.value.unshift({ id: ++ctr, code, action: r.uiAction, note })
  if (log.value.length > 10) log.value.pop()
}

function clearAll() {
  strategyEngine.clearAll()
  log.value = []
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-cyan);" />
      <h2 class="section-title">Custom Routing Strategy</h2>
      <span class="badge badge-cyan">routingStrategy</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">routingStrategy</code> overrides the UI action per-error at runtime.
      Here: modals are downgraded to toasts when 2+ errors are already active — preventing UI overload.
    </p>

    <div style="background: rgba(0,212,255,0.04); border: 1px solid rgba(0,212,255,0.1); border-radius: 5px; padding: 10px 12px; margin-bottom: 14px; font-size: 11px; color: var(--text-dim);">
      Strategy: if <code style="color: var(--accent-cyan);">activeCount >= 2</code>, downgrade <code style="color: var(--accent-purple);">modal</code> → <code style="color: var(--accent-yellow);">toast</code>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-warning" @click="fire('STRAT_TOAST_A')">Add Toast A (fills slot)</button>
      <button class="btn btn-info" @click="fire('STRAT_TOAST_B')">Add Toast B (fills slot)</button>
      <button class="btn btn-purple" @click="fire('STRAT_MODAL')">Trigger modal (may downgrade)</button>
      <button class="btn btn-ghost btn-sm" @click="clearAll">Clear all</button>
    </div>

    <div v-if="log.length" class="code-block" style="font-size: 11px;">
      <div v-for="row in log" :key="row.id" style="display: grid; grid-template-columns: 20px 150px 80px 1fr; gap: 8px; padding: 3px 0; border-bottom: 1px solid #1e1e35; align-items: center;">
        <span style="color: var(--text-muted);">{{ row.id }}</span>
        <span style="color: var(--accent-cyan);">{{ row.code }}</span>
        <span :style="{ color: row.action === 'modal' ? 'var(--accent-purple)' : 'var(--accent-yellow)' }">{{ row.action }}</span>
        <span style="color: var(--text-muted); font-size: 10px;">{{ row.note }}</span>
      </div>
    </div>

    <div style="margin-top: 14px;" class="code-block">routingStrategy: (error, entry, { activeCount }) => {
  if (entry?.ui === 'modal' && activeCount >= 2) return 'toast'
  return entry?.ui ?? 'toast'
}</div>
  </div>
</template>
