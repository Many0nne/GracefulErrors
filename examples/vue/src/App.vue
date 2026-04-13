<script setup lang="ts">
import { ref, computed } from "vue";
import { createFetch } from "gracefulerrors";
import { useErrorEngine } from "gracefulerrors/vue";

/**
 * Simulated API endpoints that always respond with specific HTTP errors.
 * Local Vite dev-server routes return the requested status code without any
 * external dependency (avoids SSL/cert issues with third-party services).
 */
const ENDPOINTS: Record<string, string> = {
  "404 Not Found": "/api/error/404",
  "401 Unauthorized": "/api/error/401",
  "500 Server Error": "/api/error/500",
  "429 Rate Limited": "/api/error/429",
  "Network error": "https://localhost:0/unreachable",
};

const engine = useErrorEngine();
const loading = ref(false);
const lastResult = ref<string | null>(null);
const history = ref(engine?.getHistory() ?? []);

/**
 * createFetch wraps native fetch and forwards non-OK responses + network
 * errors to the engine automatically. mode: 'handle' resolves undefined
 * instead of throwing, so no try/catch is needed.
 */
const safeFetch = computed(() =>
  engine ? createFetch(engine, { mode: "handle" }) : null,
);

async function triggerError(label: string, url: string) {
  if (!safeFetch.value) return;
  loading.value = true;
  lastResult.value = null;
  try {
    const res = await safeFetch.value(url);
    lastResult.value = res
      ? `OK — ${res.status}`
      : `Error handled for "${label}"`;
  } finally {
    loading.value = false;
  }
}

function refreshHistory() {
  history.value = engine?.getHistory() ?? [];
}
</script>

<template>
  <div
    style="
      font-family: sans-serif;
      max-width: 480px;
      margin: 4rem auto;
      padding: 0 1rem;
    "
  >
    <h1 style="font-size: 1.5rem; margin-bottom: 0.5rem">
      GracefulErrors — Vue example
    </h1>
    <p style="color: #555; margin-bottom: 1.5rem">
      Click a button to trigger an HTTP error. The engine will route it to the
      right UI automatically (toast or modal).
    </p>

    <div style="display: flex; flex-direction: column; gap: 0.75rem">
      <button
        v-for="(url, label) in ENDPOINTS"
        :key="label"
        :disabled="loading"
        @click="triggerError(label, url)"
        style="
          padding: 0.6rem 1.2rem;
          font-size: 0.95rem;
          border-radius: 6px;
          border: 1px solid #ccc;
          background: #fff;
          cursor: pointer;
        "
        :style="{
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#f5f5f5' : '#fff',
        }"
      >
        Trigger {{ label }}
      </button>
    </div>

    <p
      v-if="lastResult"
      style="margin-top: 1.5rem; color: #333; font-size: 0.9rem"
    >
      Last result: <code>{{ lastResult }}</code>
    </p>

    <hr style="margin: 2rem 0; border-color: #eee" />

    <h2 style="font-size: 1rem; margin-bottom: 0.5rem">Error history</h2>
    <button
      @click="refreshHistory"
      style="margin-bottom: 0.75rem; font-size: 0.85rem; cursor: pointer"
    >
      Refresh history
    </button>
    <p v-if="history.length === 0" style="color: #888; font-size: 0.9rem">
      No errors recorded yet.
    </p>
    <ul
      v-else
      style="padding-left: 1.2rem; font-size: 0.85rem; line-height: 1.6"
    >
      <li v-for="(entry, i) in history" :key="i">
        <strong>{{ entry.error.code }}</strong>
        {{ " — " }}
        {{
          entry.handled
            ? `shown as ${entry.uiAction}`
            : `suppressed (${entry.reason})`
        }}
      </li>
    </ul>
  </div>
</template>
