<script setup lang="ts">
import { ref, defineComponent, h } from 'vue'
import { ErrorBoundaryWithEngine } from 'gracefulerrors/vue'

const shouldCrash = ref(false)
const crashCount = ref(0)

// A component that intentionally throws during render
const BombComponent = defineComponent({
  name: 'BombComponent',
  setup() {
    return () => {
      throw new Error('💥 Render bomb! Component threw during render.')
    }
  }
})

const WorkingComponent = defineComponent({
  name: 'WorkingComponent',
  setup() {
    return () => h('div', {
      style: 'padding: 16px; background: rgba(0,255,136,0.06); border: 1px solid rgba(0,255,136,0.2); border-radius: 6px; color: #00ff88; font-size: 12px; display: flex; align-items: center; gap: 8px;'
    }, [
      h('span', '✓'),
      h('span', 'Component rendered successfully — no error captured.')
    ])
  }
})

function triggerCrash() {
  shouldCrash.value = true
  crashCount.value++
}

function reset() {
  shouldCrash.value = false
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-red);" />
      <h2 class="section-title">ErrorBoundaryWithEngine</h2>
      <span class="badge badge-red">ErrorBoundaryWithEngine</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">ErrorBoundaryWithEngine</code> wraps a component subtree.
      When a child throws during render, it catches the error, forwards it to the engine via
      <code style="color: var(--accent-cyan); font-size: 11px;">engine.handle()</code>, and renders the <code style="color: var(--accent-cyan); font-size: 11px;">#fallback</code> slot.
    </p>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
      <button class="btn btn-danger" @click="triggerCrash" :disabled="shouldCrash">
        💥 Trigger render crash
      </button>
      <button class="btn btn-success" @click="reset" :disabled="!shouldCrash">
        ↺ Reset boundary
      </button>
      <span v-if="crashCount > 0" style="font-size: 11px; color: var(--text-muted); align-self: center;">
        Crashed {{ crashCount }}× — check event log & fallback toast
      </span>
    </div>

    <!-- The boundary -->
    <ErrorBoundaryWithEngine>
      <template #default>
        <BombComponent v-if="shouldCrash" />
        <WorkingComponent v-else />
      </template>
      <template #fallback>
        <div style="
          padding: 16px;
          background: rgba(255,68,102,0.06);
          border: 1px solid rgba(255,68,102,0.2);
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 10px;
        ">
          <div style="font-size: 20px;">⊗</div>
          <div>
            <div style="font-family: 'Syne', sans-serif; font-weight: 700; color: var(--accent-red); font-size: 13px;">Render error caught</div>
            <div style="font-size: 11px; color: var(--text-dim); margin-top: 2px;">
              The component threw during render. Error forwarded to engine.
              <span style="color: var(--accent-cyan);">Click "Reset boundary"</span> to try again.
            </div>
          </div>
        </div>
      </template>
    </ErrorBoundaryWithEngine>

    <div style="margin-top: 14px;" class="code-block">&lt;ErrorBoundaryWithEngine&gt;
  &lt;template #default&gt;&lt;MyComponent /&gt;&lt;/template&gt;
  &lt;template #fallback&gt;Something went wrong&lt;/template&gt;
&lt;/ErrorBoundaryWithEngine&gt;</div>
  </div>
</template>
