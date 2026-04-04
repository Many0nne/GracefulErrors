<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { engine } from '../engine'

interface LogEntry {
  id: number
  type: 'ERROR_ADDED' | 'ERROR_CLEARED' | 'ALL_CLEARED'
  code?: string
  action?: string
  time: string
  fresh: boolean
}

const entries = reactive<LogEntry[]>([])
let counter = 0
let unsub: (() => void) | null = null

function now() {
  const d = new Date()
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}.${d.getMilliseconds().toString().padStart(3,'0')}`
}

onMounted(() => {
  unsub = engine.subscribe((event) => {
    const entry: LogEntry = {
      id: ++counter,
      type: event.type,
      time: now(),
      fresh: true,
    }
    if (event.type === 'ERROR_ADDED') {
      entry.code = String(event.error.code)
      entry.action = event.action
    } else if (event.type === 'ERROR_CLEARED') {
      entry.code = String(event.code)
    }
    entries.unshift(entry)
    if (entries.length > 80) entries.pop()
    setTimeout(() => { entry.fresh = false }, 600)
  })
})

onUnmounted(() => { unsub?.() })

function clearLog() { entries.splice(0, entries.length) }

const typeConfig = {
  ERROR_ADDED: { color: '#ff4466', label: 'ADDED', dot: '#ff4466' },
  ERROR_CLEARED: { color: '#4d9fff', label: 'CLEARED', dot: '#4d9fff' },
  ALL_CLEARED: { color: '#00ff88', label: 'ALL CLR', dot: '#00ff88' },
}

const actionConfig: Record<string, { color: string; label: string }> = {
  toast: { color: '#ffd700', label: 'toast' },
  modal: { color: '#c084fc', label: 'modal' },
  inline: { color: '#00d4ff', label: 'inline' },
  silent: { color: '#4a4a7a', label: 'silent' },
}

const isOpen = ref(true)
</script>

<template>
  <aside :style="{
    width: isOpen ? '300px' : '44px',
    minWidth: isOpen ? '300px' : '44px',
    background: '#0a0a0f',
    borderLeft: '1px solid #1e1e35',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
    overflow: 'hidden',
    position: 'sticky',
    top: '0',
    height: '100vh',
    flexShrink: '0',
  }">
    <!-- Header -->
    <div style="
      padding: 14px 12px;
      border-bottom: 1px solid #1e1e35;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    ">
      <button
        @click="isOpen = !isOpen"
        style="
          background: transparent;
          border: 1px solid #2a2a4a;
          color: #7070aa;
          width: 22px;
          height: 22px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          flex-shrink: 0;
          transition: all 0.15s;
          font-family: 'JetBrains Mono', monospace;
        "
        :title="isOpen ? 'Collapse' : 'Expand event log'"
      >{{ isOpen ? '›' : '‹' }}</button>

      <template v-if="isOpen">
        <div style="
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 12px;
          color: #e0e0f5;
          letter-spacing: 0.04em;
          flex: 1;
          text-transform: uppercase;
        ">Event Log</div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <div class="dot-status" :class="entries.length > 0 ? 'dot-green' : 'dot-gray'" />
          <span style="font-size: 10px; color: #4a4a7a;">{{ entries.length }}</span>
        </div>

        <button
          @click="clearLog"
          style="
            background: transparent;
            border: 1px solid #1e1e35;
            color: #4a4a7a;
            padding: 3px 7px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            font-family: 'JetBrains Mono', monospace;
            transition: all 0.15s;
          "
          onmouseover="this.style.color='#7070aa';this.style.borderColor='#2a2a4a'"
          onmouseout="this.style.color='#4a4a7a';this.style.borderColor='#1e1e35'"
        >CLR</button>
      </template>
    </div>

    <!-- Collapsed state label -->
    <div v-if="!isOpen" style="
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      padding: 16px 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      letter-spacing: 0.12em;
      color: #4a4a7a;
      text-transform: uppercase;
    ">Event Log ({{ entries.length }})</div>

    <!-- Entries -->
    <div v-if="isOpen" style="flex: 1; overflow-y: auto; padding: 8px 0;">
      <div v-if="entries.length === 0" style="
        padding: 24px 16px;
        text-align: center;
        color: #2a2a4a;
        font-size: 11px;
        line-height: 1.8;
        font-family: 'JetBrains Mono', monospace;
      ">
        <div style="font-size: 20px; margin-bottom: 8px; opacity: 0.4;">⌀</div>
        No events yet.<br/>Trigger an error to see<br/>live engine events here.
      </div>

      <div
        v-for="entry in entries"
        :key="entry.id"
        :style="{
          padding: '7px 12px',
          borderBottom: '1px solid #0f0f1a',
          transition: 'background 0.4s',
          background: entry.fresh ? 'rgba(77, 159, 255, 0.04)' : 'transparent',
        }"
      >
        <!-- Top row -->
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
          <div class="dot-status" :style="{ background: typeConfig[entry.type].dot, boxShadow: entry.fresh ? `0 0 6px ${typeConfig[entry.type].dot}` : 'none' }" />
          <span :style="{
            fontSize: '9px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            color: typeConfig[entry.type].color,
            fontFamily: 'JetBrains Mono, monospace',
          }">{{ typeConfig[entry.type].label }}</span>

          <span v-if="entry.action && actionConfig[entry.action]" :style="{
            fontSize: '9px',
            padding: '1px 5px',
            borderRadius: '2px',
            background: `${actionConfig[entry.action].color}18`,
            color: actionConfig[entry.action].color,
            border: `1px solid ${actionConfig[entry.action].color}30`,
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.04em',
          }">{{ entry.action }}</span>

          <span style="margin-left: auto; font-size: 9px; color: #2a2a4a; font-family: 'JetBrains Mono', monospace;">{{ entry.time }}</span>
        </div>

        <!-- Code -->
        <div v-if="entry.code" style="
          font-size: 10px;
          color: #7070aa;
          padding-left: 12px;
          font-family: 'JetBrains Mono', monospace;
          word-break: break-all;
        ">{{ entry.code }}</div>
        <div v-else style="
          font-size: 10px;
          color: #2a2a4a;
          padding-left: 12px;
          font-family: 'JetBrains Mono', monospace;
        ">[all errors cleared]</div>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="isOpen" style="
      padding: 10px 12px;
      border-top: 1px solid #1e1e35;
      flex-shrink: 0;
    ">
      <div style="font-size: 9px; color: #2a2a4a; margin-bottom: 6px; letter-spacing: 0.08em; text-transform: uppercase; font-family: 'JetBrains Mono', monospace;">Legend</div>
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <div v-for="(cfg, type) in typeConfig" :key="type" style="display: flex; align-items: center; gap: 6px;">
          <div class="dot-status" :style="{ background: cfg.dot }" />
          <span :style="{ fontSize: '9px', color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }">{{ cfg.label }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>
