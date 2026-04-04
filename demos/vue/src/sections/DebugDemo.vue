<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, builtInNormalizer } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

const debugEngine = createErrorEngine({
  registry: {
    DEBUG_ERR: { ui: 'toast', message: 'Debug trace enabled — check console.', ttl: 3500, uiOptions: { severity: 'info' } },
    DEBUG_WARN: { ui: 'toast', message: 'Debug warning trace.', ttl: 3000, uiOptions: { severity: 'warning' } },
  },
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
  fallback: { ui: 'toast', message: 'Fallback (with debug trace).' },
  allowFallback: true,
  debug: { trace: true },
})

const isOpen = ref(false)

function trigger(code: string) {
  debugEngine.handle({ code })
}

function triggerUnknown() {
  debugEngine.handle({ code: 'UNLISTED_CODE_XYZ' })
}

function triggerError() {
  debugEngine.handle(new Error('A raw JS error with debug trace'))
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-orange);" />
      <h2 class="section-title">Debug Mode</h2>
      <span class="badge badge-orange">debug: { trace: true }</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">debug: true</code> or
      <code style="color: var(--accent-cyan); font-size: 11px;">debug: { trace: true }</code> emits a
      <code style="color: var(--accent-cyan); font-size: 11px;">console.log('[gracefulerrors trace]', ...)</code>
      for every <code style="color: var(--accent-cyan); font-size: 11px;">handle()</code> call with the full processing context.
      Open DevTools console to see the traces.
    </p>

    <div style="
      background: rgba(255,140,66,0.05);
      border: 1px solid rgba(255,140,66,0.15);
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 16px;
      font-size: 11px;
      color: var(--accent-orange);
      display: flex;
      align-items: center;
      gap: 8px;
    ">
      <span style="font-size: 16px;">⚡</span>
      <span>Open DevTools → Console to see <strong>[gracefulerrors trace]</strong> logs</span>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-info" @click="trigger('DEBUG_ERR')">Trace info error</button>
      <button class="btn btn-warning" @click="trigger('DEBUG_WARN')">Trace warning</button>
      <button class="btn btn-orange" @click="triggerUnknown">Trace unknown code (fallback)</button>
      <button class="btn btn-danger" @click="triggerError">Trace raw Error object</button>
    </div>

    <!-- Collapsible config -->
    <div style="border: 1px solid var(--border-dim); border-radius: 5px; overflow: hidden;">
      <div
        style="padding: 8px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; background: var(--bg-raised);"
        @click="isOpen = !isOpen"
      >
        <span style="font-size: 10px; color: var(--text-muted);">{{ isOpen ? '▼' : '▶' }}</span>
        <span style="font-size: 11px; color: var(--text-dim);">Engine configuration</span>
      </div>
      <div v-if="isOpen" class="code-block" style="border-radius: 0; border: none; border-top: 1px solid var(--border-dim);">createErrorEngine({
  registry: { DEBUG_ERR: { ui: 'toast', ... } },
  debug: { trace: true },
  // Each handle() call logs:
  // { raw, normalized, action, entry, placement }
})</div>
    </div>
  </div>
</template>
