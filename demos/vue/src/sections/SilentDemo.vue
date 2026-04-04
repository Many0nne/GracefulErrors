<script setup lang="ts">
import { ref } from 'vue'
import { engine } from '../engine'

interface ResultRow {
  id: number
  raw: string
  handled: boolean
  code: string
  uiAction: string | null
}

let ctr = 0
const results = ref<ResultRow[]>([])

function trigger(raw: unknown, label: string) {
  const result = engine.handle(raw)
  results.value.unshift({
    id: ++ctr,
    raw: label,
    handled: result.handled,
    code: String(result.error.code),
    uiAction: result.uiAction,
  })
  if (results.value.length > 8) results.value.pop()
}

function clearResults() { results.value = [] }
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--text-muted);" />
      <h2 class="section-title">Silent Errors</h2>
      <span class="badge badge-gray">ui: 'silent'</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      Silent errors are processed by the engine (normalized, callbacks fired, state tracked) but produce
      no visible UI. Useful for logging/telemetry without user-facing noise.
      <code style="color: var(--accent-cyan); font-size: 11px;">handle()</code> returns <code style="color: var(--accent-cyan); font-size: 11px;">{ handled: true, uiAction: null }</code>.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-ghost" @click="trigger({ code: 'SYS_SILENT_METRIC' }, '{ code: SYS_SILENT_METRIC }')">
        Trigger silent error
      </button>
      <button class="btn btn-ghost" @click="trigger({ code: 'SYS_SILENT_METRIC' }, '{ code: SYS_SILENT_METRIC }')">
        Again (dedupe test)
      </button>
      <button class="btn btn-ghost btn-sm" @click="clearResults">Clear results</button>
    </div>

    <div v-if="results.length > 0">
      <div style="font-size: 10px; color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">
        handle() return values
      </div>
      <div class="code-block" style="font-size: 11px;">
        <div v-for="r in results" :key="r.id" style="display: flex; gap: 12px; padding: 3px 0; border-bottom: 1px solid #1e1e35;">
          <span style="color: var(--text-muted); width: 20px;">{{ r.id }}</span>
          <span :style="{ color: r.handled ? 'var(--accent-green)' : 'var(--accent-red)', width: '60px' }">
            {{ r.handled ? 'handled' : 'dropped' }}
          </span>
          <span style="color: var(--text-dim); width: 180px;">{{ r.code }}</span>
          <span :style="{ color: r.uiAction ? 'var(--accent-yellow)' : 'var(--text-muted)' }">
            uiAction: {{ r.uiAction ?? 'null' }}
          </span>
        </div>
      </div>
    </div>
    <div v-else style="color: var(--text-muted); font-size: 11px; text-align: center; padding: 16px;">
      Trigger a silent error — watch the event log, not this area.
    </div>

    <div style="margin-top: 14px;" class="code-block">SYS_SILENT_METRIC: { ui: 'silent' }
// handle() → { handled: true, error: {...}, uiAction: null }</div>
  </div>
</template>
