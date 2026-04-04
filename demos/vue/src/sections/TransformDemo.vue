<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, builtInNormalizer } from 'gracefulerrors'
import type { AppError } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

// Engine with transform: upgrades severity and suppresses noise
const transformEngine = createErrorEngine({
  registry: {
    NET_ERROR: { ui: 'toast', message: 'Network error occurred.', ttl: 4000, uiOptions: { severity: 'error' } },
    NET_WARN: { ui: 'toast', message: 'Network warning.', ttl: 3000, uiOptions: { severity: 'warning' } },
    SUPPRESSED_NOISE: { ui: 'silent' },
  },
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
  transform: (error: AppError) => {
    // Suppress anything tagged as noise
    if (error.context?.['noisy']) {
      return { suppress: true, reason: 'Tagged as noisy' }
    }
    // Downgrade to warning if status < 500
    if (error.code === 'NET_ERROR' && (error.status ?? 500) < 500) {
      return { ...error, code: 'NET_WARN' }
    }
    // Enrich with context
    if (error.code === 'NET_ERROR') {
      return { ...error, context: { ...error.context, enriched: true, timestamp: Date.now() } }
    }
    return null
  },
})

const log = ref<Array<{ input: string; output: string; color: string }>>([])

function run(raw: unknown, label: string) {
  const r = transformEngine.handle(raw)
  log.value.unshift({
    input: label,
    output: `code=${String(r.error.code)} action=${r.uiAction ?? 'null'} handled=${r.handled}`,
    color: r.handled ? 'var(--accent-green)' : 'var(--text-muted)',
  })
  if (log.value.length > 8) log.value.pop()
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-green);" />
      <h2 class="section-title">Transform Pipeline</h2>
      <span class="badge badge-green">transform</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      The <code style="color: var(--accent-cyan); font-size: 11px;">transform</code> function intercepts normalized errors before routing.
      It can suppress errors, mutate codes, enrich context, or return <code style="color: var(--accent-cyan); font-size: 11px;">null</code> for no change.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-danger" @click="run({ code: 'NET_ERROR', status: 500 }, 'NET_ERROR status=500')">
        500 error → kept as error
      </button>
      <button class="btn btn-warning" @click="run({ code: 'NET_ERROR', status: 400 }, 'NET_ERROR status=400')">
        400 error → downgraded to NET_WARN
      </button>
      <button class="btn btn-ghost" @click="run({ code: 'NET_ERROR', context: { noisy: true } }, 'noisy=true')">
        Noisy error → suppressed
      </button>
    </div>

    <div v-if="log.length">
      <div class="code-block" style="font-size: 11px;">
        <div v-for="(row, i) in log" :key="i" style="padding: 4px 0; border-bottom: 1px solid #1e1e35;">
          <div style="color: var(--text-muted);">in: {{ row.input }}</div>
          <div :style="{ color: row.color }">out: {{ row.output }}</div>
        </div>
      </div>
    </div>

    <div style="margin-top: 14px;" class="code-block">transform: (error) => {
  if (error.context?.noisy) return { suppress: true, reason: 'Noisy' }
  if (error.status &lt; 500) return { ...error, code: 'NET_WARN' }
  return null // no change
}</div>
  </div>
</template>
