<script setup lang="ts">
import { ref } from 'vue'
import { createFetch } from 'gracefulerrors'
import { engine } from '../engine'

const fetchHandle = createFetch(engine, { mode: 'handle' })
const fetchThrow = createFetch(engine, { mode: 'throw' })
const fetchSilent = createFetch(engine, { mode: 'silent' })

const log = ref<Array<{ id: number; url: string; mode: string; result: string; color: string }>>([])
let ctr = 0

async function tryFetch(
  fn: ReturnType<typeof createFetch>,
  url: string,
  mode: string
) {
  try {
    const res = await fn(url)
    if (res) {
      log.value.unshift({ id: ++ctr, url, mode, result: `OK ${res.status}`, color: 'var(--accent-green)' })
    } else {
      log.value.unshift({ id: ++ctr, url, mode, result: 'undefined (handled by engine)', color: 'var(--accent-yellow)' })
    }
  } catch (e) {
    log.value.unshift({ id: ++ctr, url, mode, result: `THROWN: ${e instanceof Error ? e.message : String(e)}`, color: 'var(--accent-red)' })
  }
  if (log.value.length > 10) log.value.pop()
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-blue);" />
      <h2 class="section-title">createFetch Wrapper</h2>
      <span class="badge badge-blue">createFetch</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">createFetch(engine, { mode })</code> wraps native <code style="color: var(--accent-cyan); font-size: 11px;">fetch</code>.
      On non-OK responses, it automatically routes errors through the engine.
      Three modes: <code style="color: var(--accent-green); font-size: 11px;">'handle'</code> (engine handles, returns undefined),
      <code style="color: var(--accent-red); font-size: 11px;">'throw'</code> (re-throws after handling),
      <code style="color: var(--text-dim); font-size: 11px;">'silent'</code> (engine skipped, throw through).
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <!-- mode: handle -->
      <button class="btn btn-success" @click="tryFetch(fetchHandle, 'https://httpbin.org/get', 'handle')">
        200 OK (handle)
      </button>
      <button class="btn btn-danger" @click="tryFetch(fetchHandle, 'https://httpbin.org/status/404', 'handle')">
        404 — mode: handle
      </button>
      <button class="btn btn-danger" @click="tryFetch(fetchHandle, 'https://httpbin.org/status/500', 'handle')">
        500 — mode: handle
      </button>
      <button class="btn btn-warning" @click="tryFetch(fetchThrow, 'https://httpbin.org/status/401', 'throw')">
        401 — mode: throw
      </button>
      <button class="btn btn-ghost" @click="tryFetch(fetchSilent, 'https://httpbin.org/status/400', 'silent')">
        400 — mode: silent
      </button>
      <button class="btn btn-ghost" @click="tryFetch(fetchHandle, 'https://this-domain-does-not-exist-xyz.com', 'handle')">
        Network failure (handle)
      </button>
    </div>

    <div v-if="log.length">
      <div class="code-block" style="font-size: 11px;">
        <div v-for="row in log" :key="row.id" style="padding: 4px 0; border-bottom: 1px solid #1e1e35; display: grid; grid-template-columns: 20px 80px 180px 1fr; gap: 8px; align-items: center;">
          <span style="color: var(--text-muted);">{{ row.id }}</span>
          <span style="color: var(--accent-purple);">{{ row.mode }}</span>
          <span style="color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" :title="row.url">{{ row.url.replace('https://', '') }}</span>
          <span :style="{ color: row.color }">{{ row.result }}</span>
        </div>
      </div>
    </div>
    <div v-else style="color: var(--text-muted); font-size: 11px; padding: 12px 0;">
      Click a button to fire a fetch request. Errors route through the engine automatically.
    </div>

    <div style="margin-top: 14px;" class="code-block">const fetch = createFetch(engine, { mode: 'handle' })
// Non-OK response → engine.handle(payload) → returns undefined</div>
  </div>
</template>
