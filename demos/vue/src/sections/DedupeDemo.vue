<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, builtInNormalizer } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

const stats = ref({ fired: 0, handled: 0, dropped: 0 })

const dedupeEngine = createErrorEngine({
  registry: {
    DEDUPE_ERROR: { ui: 'toast', message: 'Deduplicated (800ms window).', ttl: 3000 },
  },
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
  dedupeWindow: 800,
  onDropped: (_err, reason) => {
    if (reason === 'dedupe') stats.value.dropped++
  },
})

function spam() {
  stats.value.fired++
  const r = dedupeEngine.handle({ code: 'DEDUPE_ERROR' })
  if (r.handled) stats.value.handled++
  else stats.value.dropped++
}

function rapidFire() {
  for (let i = 0; i < 5; i++) {
    stats.value.fired++
    const r = dedupeEngine.handle({ code: 'DEDUPE_ERROR' })
    if (r.handled) stats.value.handled++
    else stats.value.dropped++
  }
}

function resetStats() {
  stats.value = { fired: 0, handled: 0, dropped: 0 }
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-blue);" />
      <h2 class="section-title">Deduplication</h2>
      <span class="badge badge-blue">dedupeWindow</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">dedupeWindow: 800</code> suppresses identical errors
      within an 800ms sliding window. Fingerprint is <code style="color: var(--accent-cyan); font-size: 11px;">code:status:field</code> by default.
    </p>

    <!-- Stats -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; max-width: 320px;">
      <div style="background: var(--bg-void); border: 1px solid var(--border-dim); border-radius: 6px; padding: 10px; text-align: center;">
        <div style="font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--text-white);">{{ stats.fired }}</div>
        <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;">Fired</div>
      </div>
      <div style="background: var(--bg-void); border: 1px solid var(--border-dim); border-radius: 6px; padding: 10px; text-align: center;">
        <div style="font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--accent-green);">{{ stats.handled }}</div>
        <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;">Handled</div>
      </div>
      <div style="background: var(--bg-void); border: 1px solid var(--border-dim); border-radius: 6px; padding: 10px; text-align: center;">
        <div style="font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800; color: var(--accent-red);">{{ stats.dropped }}</div>
        <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em;">Deduped</div>
      </div>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      <button class="btn btn-primary" @click="spam">Trigger once</button>
      <button class="btn btn-warning" @click="rapidFire">Rapid fire × 5</button>
      <button class="btn btn-ghost btn-sm" @click="resetStats">Reset stats</button>
    </div>

    <div style="margin-top: 14px;" class="code-block">createErrorEngine({ dedupeWindow: 800 })
// Identical fingerprint within 800ms → dropped</div>
  </div>
</template>
