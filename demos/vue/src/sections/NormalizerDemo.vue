<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, builtInNormalizer } from 'gracefulerrors'
import type { AppError, Normalizer } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

// Custom normalizer: understands { errorCode, errorMessage } shape
const customNormalizer: Normalizer = (raw, current) => {
  if (current) return current // already normalized
  if (raw && typeof raw === 'object' && 'errorCode' in raw) {
    const r = raw as { errorCode: string; errorMessage?: string; details?: unknown }
    return {
      code: r.errorCode,
      message: r.errorMessage,
      context: { details: r.details },
    } as AppError
  }
  return null
}

const normEngine = createErrorEngine({
  registry: {
    API_ERROR: { ui: 'toast', message: 'API error handled by custom normalizer.', ttl: 4000, uiOptions: { severity: 'error' } },
    AUTH_EXPIRED: { ui: 'toast', message: 'Session expired!', ttl: 4000, uiOptions: { severity: 'warning' } },
    UNKNOWN_ERR: { ui: 'toast', message: 'Caught by builtInNormalizer.', ttl: 4000 },
  },
  normalizers: [customNormalizer, builtInNormalizer],
  renderer: createVueRenderer(),
  fallback: { ui: 'toast', message: 'Fallback error after normalization.' },
  allowFallback: true,
})

interface Row { id: number; input: string; code: string; message: string; source: string }
let ctr = 0
const rows = ref<Row[]>([])

// Helper containing a quoted raw string to avoid nested-quote parsing in template
const rawQuoted = '"raw string"'

function run(raw: unknown, label: string, source: string) {
  const r = normEngine.handle(raw)
  rows.value.unshift({
    id: ++ctr,
    input: label,
    code: String(r.error.code),
    message: r.error.message ?? '—',
    source,
  })
  if (rows.value.length > 8) rows.value.pop()
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-cyan);" />
      <h2 class="section-title">Normalizers</h2>
      <span class="badge badge-cyan">normalizers[]</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      Chain multiple normalizers. The pipeline stops at the first non-null result.
      <code style="color: var(--accent-cyan); font-size: 11px;">builtInNormalizer</code> handles <code style="color: var(--accent-cyan); font-size: 11px;">Error</code>,
      Response objects, and plain objects with <code style="color: var(--accent-cyan); font-size: 11px;">{ code }</code>.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-info" @click="run({ errorCode: 'API_ERROR', errorMessage: 'Custom shape' }, '{ errorCode, errorMessage }', 'customNormalizer')">
        Custom shape → customNormalizer
      </button>
      <button class="btn btn-danger" @click="run(new Error('Something went wrong'), 'new Error()', 'builtInNormalizer')">
        new Error() → builtInNormalizer
      </button>
      <button class="btn btn-warning" @click="run({ code: 'AUTH_EXPIRED', status: 401 }, '{ code, status }', 'builtInNormalizer')">
        Plain { code } → builtInNormalizer
      </button>
      <button class="btn btn-ghost" @click="run('raw string error', rawQuoted, 'fallback')">
        Raw string → fallback
      </button>
    </div>

    <div v-if="rows.length">
      <div class="code-block" style="font-size: 11px;">
        <div v-for="row in rows" :key="row.id" style="padding: 4px 0; border-bottom: 1px solid #1e1e35;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <span style="color: var(--text-muted);">{{ row.input }}</span>
            <span style="color: var(--text-dim);">→</span>
            <span style="color: var(--accent-cyan);">code: {{ row.code }}</span>
            <span style="color: var(--accent-purple); font-size: 10px;">[{{ row.source }}]</span>
          </div>
          <div style="color: var(--text-muted); padding-left: 12px; font-size: 10px;">msg: {{ row.message }}</div>
        </div>
      </div>
    </div>

    <div style="margin-top: 14px;" class="code-block">normalizers: [customNormalizer, builtInNormalizer]
// Pipeline: try each normalizer in order, stop at first non-null</div>
  </div>
</template>
