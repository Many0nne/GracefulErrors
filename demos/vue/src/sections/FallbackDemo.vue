<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, builtInNormalizer } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

// Separate engine with fallback enabled
const fallbackEngine = createErrorEngine({
  registry: {
    KNOWN_ERROR: { ui: 'toast', message: 'Known error handled from registry.' },
  },
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
  fallback: { ui: 'toast', message: 'Fallback: something unexpected happened.' },
  allowFallback: true,
})

// Separate engine with fallback disabled (strict)
const strictEngine = createErrorEngine({
  registry: {
    KNOWN_ERROR: { ui: 'toast', message: 'Known error handled.' },
  },
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
  allowFallback: false,
})

interface Row { id: number; label: string; code: string; action: string; note: string }
let ctr = 0
const rows = ref<Row[]>([])

function run(eng: typeof fallbackEngine, label: string, raw: unknown, note: string) {
  try {
    const r = eng.handle(raw)
    rows.value.unshift({ id: ++ctr, label, code: String(r.error.code), action: r.uiAction ?? 'null', note })
    if (rows.value.length > 10) rows.value.pop()
  } catch (e) {
    rows.value.unshift({ id: ++ctr, label, code: '—', action: 'THROWN', note: String(e) })
    if (rows.value.length > 10) rows.value.pop()
  }
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-orange);" />
      <h2 class="section-title">Fallback Handling</h2>
      <span class="badge badge-orange">allowFallback / fallback</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      When an error code is not in the registry, the engine can use a <code style="color: var(--accent-cyan); font-size: 11px;">fallback</code>
      UI action, or silently drop it if <code style="color: var(--accent-cyan); font-size: 11px;">allowFallback: false</code>.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-success" @click="run(fallbackEngine, 'registry hit', { code: 'KNOWN_ERROR' }, 'Registry match')">
        Known error (registry hit)
      </button>
      <button class="btn btn-orange" @click="run(fallbackEngine, 'unknown + fallback', { code: 'SOME_RANDOM_CODE' }, 'Uses fallback ui=toast')">
        Unknown + allowFallback=true
      </button>
      <button class="btn btn-ghost" @click="run(strictEngine, 'unknown + no fallback', { code: 'SOME_RANDOM_CODE' }, 'allowFallback=false → dropped')">
        Unknown + allowFallback=false
      </button>
      <button class="btn btn-ghost" @click="run(fallbackEngine, 'raw Error', new Error('Something broke'), 'Normalized + fallback')">
        Raw JS Error → fallback
      </button>
    </div>

    <div v-if="rows.length">
      <div class="code-block" style="font-size: 11px;">
        <div v-for="r in rows" :key="r.id" style="display: grid; grid-template-columns: 20px 160px 200px 80px 1fr; gap: 8px; padding: 3px 0; border-bottom: 1px solid #1e1e35; align-items: center;">
          <span style="color: var(--text-muted);">{{ r.id }}</span>
          <span style="color: var(--text-dim);">{{ r.label }}</span>
          <span style="color: var(--accent-cyan);">{{ r.code }}</span>
          <span :style="{ color: r.action === 'THROWN' ? 'var(--accent-red)' : r.action === 'null' ? 'var(--text-muted)' : 'var(--accent-green)' }">{{ r.action }}</span>
          <span style="color: var(--text-muted); font-size: 10px;">{{ r.note }}</span>
        </div>
      </div>
    </div>

    <div style="margin-top: 14px;" class="code-block">createErrorEngine({
  fallback: { ui: 'toast', message: 'Something unexpected happened.' },
  allowFallback: true,  // default: true
})</div>
  </div>
</template>
