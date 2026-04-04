<script setup lang="ts">
import { ref } from 'vue'
import { createErrorEngine, builtInNormalizer } from 'gracefulerrors'
import { createVueRenderer } from '../renderer'

const concurrentEngine = createErrorEngine({
  registry: {
    ERR_A: { ui: 'toast', message: 'Error A — concurrent slot 1', ttl: 6000 },
    ERR_B: { ui: 'toast', message: 'Error B — concurrent slot 2', ttl: 6000 },
    ERR_C: { ui: 'toast', message: 'Error C — concurrent slot 3', ttl: 6000 },
    ERR_D: { ui: 'toast', message: 'Error D — queued (maxConcurrent=3)', ttl: 6000 },
    ERR_E: { ui: 'toast', message: 'Error E — queued (maxQueue=2)', ttl: 6000 },
    ERR_F: { ui: 'toast', message: 'Error F — dropped (queue full)', ttl: 6000 },
  },
  normalizers: [builtInNormalizer],
  renderer: createVueRenderer(),
  maxConcurrent: 3,
  maxQueue: 2,
  dedupeWindow: 0,
})

const log = ref<Array<{ code: string; result: string; color: string }>>([])

function fire(code: string) {
  const r = concurrentEngine.handle({ code })
  const result = r.handled ? `→ ${r.uiAction ?? 'queued'}` : '→ dropped'
  const color = r.handled ? 'var(--accent-green)' : 'var(--accent-red)'
  log.value.unshift({ code, result, color })
  if (log.value.length > 10) log.value.pop()
}

function fireAll() {
  ;(['ERR_A', 'ERR_B', 'ERR_C', 'ERR_D', 'ERR_E', 'ERR_F'] as const).forEach((c) => fire(c))
}

function clearAll() {
  concurrentEngine.clearAll()
  log.value = []
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-pink);" />
      <h2 class="section-title">Concurrency &amp; Queue</h2>
      <span class="badge" style="background: rgba(255,110,180,0.1); color: var(--accent-pink); border: 1px solid rgba(255,110,180,0.2);">maxConcurrent / maxQueue</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">maxConcurrent: 3</code> limits simultaneous active errors.
      Additional errors enter a queue of size <code style="color: var(--accent-cyan); font-size: 11px;">maxQueue: 2</code>.
      Beyond that, they are dropped.
    </p>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px; max-width: 360px;">
      <div style="background: rgba(0,255,136,0.05); border: 1px solid rgba(0,255,136,0.15); border-radius: 5px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; color: var(--accent-green); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Active slots</div>
        <div style="font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: var(--accent-green);">3</div>
      </div>
      <div style="background: rgba(255,215,0,0.05); border: 1px solid rgba(255,215,0,0.15); border-radius: 5px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; color: var(--accent-yellow); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Max queue</div>
        <div style="font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: var(--accent-yellow);">2</div>
      </div>
      <div style="background: rgba(255,68,102,0.05); border: 1px solid rgba(255,68,102,0.15); border-radius: 5px; padding: 8px; text-align: center;">
        <div style="font-size: 9px; color: var(--accent-red); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Dropped</div>
        <div style="font-family: 'Syne', sans-serif; font-weight: 800; font-size: 18px; color: var(--accent-red);">overflow</div>
      </div>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-success btn-sm" @click="fire('ERR_A')">ERR_A</button>
      <button class="btn btn-success btn-sm" @click="fire('ERR_B')">ERR_B</button>
      <button class="btn btn-success btn-sm" @click="fire('ERR_C')">ERR_C</button>
      <button class="btn btn-warning btn-sm" @click="fire('ERR_D')">ERR_D (queued)</button>
      <button class="btn btn-warning btn-sm" @click="fire('ERR_E')">ERR_E (queued)</button>
      <button class="btn btn-danger btn-sm" @click="fire('ERR_F')">ERR_F (dropped)</button>
      <button class="btn btn-primary" @click="fireAll">Fire all 6</button>
      <button class="btn btn-ghost btn-sm" @click="clearAll">Clear all</button>
    </div>

    <div v-if="log.length">
      <div class="code-block" style="font-size: 11px;">
        <div v-for="(row, i) in log" :key="i" style="display: flex; gap: 12px; padding: 2px 0;">
          <span style="color: var(--text-muted); width: 80px;">{{ row.code }}</span>
          <span :style="{ color: row.color }">{{ row.result }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
