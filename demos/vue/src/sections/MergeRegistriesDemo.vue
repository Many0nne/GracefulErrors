<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, mergeRegistries, builtInNormalizer } from 'gracefulerrors'
import type { ErrorRegistry } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

const baseRegistry: ErrorRegistry<'BASE_A' | 'BASE_B'> = {
  BASE_A: { ui: 'toast', message: 'Base registry: Error A', ttl: 3000, uiOptions: { severity: 'info' } },
  BASE_B: { ui: 'toast', message: 'Base registry: Error B (overrideable)', ttl: 3000, uiOptions: { severity: 'warning' } },
}

const overrideRegistry: ErrorRegistry<'BASE_B' | 'EXTENSION_C'> = {
  BASE_B: { ui: 'toast', message: 'Override: BASE_B message replaced!', ttl: 4000, uiOptions: { severity: 'error' } },
  EXTENSION_C: { ui: 'toast', message: 'Extension registry: Error C', ttl: 3000, uiOptions: { severity: 'success' } },
}

const merged = mergeRegistries(
  baseRegistry as ErrorRegistry<'BASE_A' | 'BASE_B' | 'EXTENSION_C'>,
  overrideRegistry as ErrorRegistry<'BASE_A' | 'BASE_B' | 'EXTENSION_C'>
)

const mergedEngine = createErrorEngine({
  registry: merged,
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
})

const log = ref<Array<{ id: number; code: string; msg: string }>>([])
let ctr = 0

function fire(code: string) {
  const r = mergedEngine.handle({ code })
  log.value.unshift({ id: ++ctr, code, msg: r.error.message ?? '—' })
  if (log.value.length > 8) log.value.pop()
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-purple);" />
      <h2 class="section-title">mergeRegistries</h2>
      <span class="badge badge-purple">mergeRegistries</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">mergeRegistries(base, override)</code> creates a shallow merge.
      Override entries take precedence. Useful for composing domain registries or extending a base registry.
    </p>

    <!-- Visual merge diagram -->
    <div style="display: grid; grid-template-columns: 1fr 24px 1fr 24px 1fr; gap: 0; align-items: stretch; margin-bottom: 16px; font-size: 10px;">
      <div style="background: var(--bg-void); border: 1px solid var(--border-dim); border-radius: 5px; padding: 10px;">
        <div style="color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px;">Base</div>
        <div style="color: var(--accent-blue); margin: 2px 0;">BASE_A → info</div>
        <div style="color: var(--accent-yellow); margin: 2px 0;">BASE_B → warning</div>
      </div>
      <div style="display: flex; align-items: center; justify-content: center; color: var(--text-muted);">+</div>
      <div style="background: var(--bg-void); border: 1px solid var(--border-dim); border-radius: 5px; padding: 10px;">
        <div style="color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px;">Override</div>
        <div style="color: var(--accent-red); margin: 2px 0;">BASE_B → error ★</div>
        <div style="color: var(--accent-green); margin: 2px 0;">EXTENSION_C → success</div>
      </div>
      <div style="display: flex; align-items: center; justify-content: center; color: var(--text-muted);">=</div>
      <div style="background: var(--bg-void); border: 1px solid rgba(192,132,252,0.2); border-radius: 5px; padding: 10px;">
        <div style="color: var(--accent-purple); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px;">Merged</div>
        <div style="color: var(--accent-blue); margin: 2px 0;">BASE_A → info</div>
        <div style="color: var(--accent-red); margin: 2px 0;">BASE_B → error ★</div>
        <div style="color: var(--accent-green); margin: 2px 0;">EXTENSION_C → success</div>
      </div>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
      <button class="btn btn-info" @click="fire('BASE_A')">BASE_A (from base)</button>
      <button class="btn btn-danger" @click="fire('BASE_B')">BASE_B (overridden)</button>
      <button class="btn btn-success" @click="fire('EXTENSION_C')">EXTENSION_C (new)</button>
    </div>

    <div v-if="log.length" class="code-block" style="font-size: 11px;">
      <div v-for="row in log" :key="row.id" style="display: flex; gap: 10px; padding: 2px 0; border-bottom: 1px solid #1e1e35;">
        <span style="color: var(--accent-cyan); min-width: 120px;">{{ row.code }}</span>
        <span style="color: var(--text-dim);">{{ row.msg }}</span>
      </div>
    </div>
  </div>
</template>
