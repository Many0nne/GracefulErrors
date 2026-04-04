<script setup lang="ts">
import { reactive } from 'vue'
import { engine, callbackLog } from '../engine'

const typeColors: Record<string, string> = {
  onError: 'var(--accent-red)',
  onNormalized: 'var(--accent-cyan)',
  onRouted: 'var(--accent-green)',
  onSuppressed: 'var(--accent-yellow)',
  onFallback: 'var(--accent-orange)',
  onDropped: 'var(--accent-pink)',
}

function trigger(code: string) {
  engine.handle({ code })
}

function clearLog() {
  callbackLog.splice(0, callbackLog.length)
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-green);" />
      <h2 class="section-title">Lifecycle Callbacks</h2>
      <span class="badge badge-green">onError / onNormalized / onRouted…</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      The engine exposes lifecycle hooks fired at each processing step.
      All hooks from the main engine are logged below in real-time.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px;">
      <span class="badge" v-for="(color, cb) in typeColors" :key="cb" :style="{ background: `${color}15`, color, border: `1px solid ${color}30` }">
        {{ cb }}
      </span>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
      <button class="btn btn-danger" @click="trigger('AUTH_EXPIRED')">Trigger AUTH_EXPIRED</button>
      <button class="btn btn-warning" @click="trigger('NETWORK_TIMEOUT')">Trigger NETWORK_TIMEOUT</button>
      <button class="btn btn-ghost" @click="trigger('SOME_UNKNOWN_CODE')">Trigger unknown (onFallback)</button>
      <button class="btn btn-ghost btn-sm" @click="clearLog">Clear log</button>
    </div>

    <div style="
      background: var(--bg-void);
      border: 1px solid var(--border-dim);
      border-radius: 6px;
      max-height: 260px;
      overflow-y: auto;
    ">
      <div v-if="callbackLog.length === 0" style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 11px;">
        No callbacks fired yet. Trigger an error above.
      </div>
      <div
        v-for="(entry, i) in callbackLog"
        :key="i"
        style="padding: 6px 12px; border-bottom: 1px solid #0f0f1a; display: flex; gap: 10px; align-items: flex-start;"
      >
        <span style="font-size: 9px; color: var(--text-muted); flex-shrink: 0; padding-top: 2px; min-width: 80px;">{{ entry.time }}</span>
        <span
          :style="{
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '0.06em',
            color: typeColors[entry.type] || 'var(--text-dim)',
            flexShrink: '0',
            minWidth: '110px',
          }"
        >{{ entry.type }}</span>
        <span style="font-size: 10px; color: var(--text-dim); word-break: break-all;">{{ entry.detail }}</span>
      </div>
    </div>
  </div>
</template>
