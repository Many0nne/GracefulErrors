<script setup lang="ts">
import { ref, computed } from 'vue'
import ToastContainer from './components/ToastContainer.vue'
import ModalContainer from './components/ModalContainer.vue'
import EventLog from './components/EventLog.vue'

import ToastDemo from './sections/ToastDemo.vue'
import ModalDemo from './sections/ModalDemo.vue'
import InlineDemo from './sections/InlineDemo.vue'
import SilentDemo from './sections/SilentDemo.vue'
import FallbackDemo from './sections/FallbackDemo.vue'
import DedupeDemo from './sections/DedupeDemo.vue'
import MaxConcurrentDemo from './sections/MaxConcurrentDemo.vue'
import TransformDemo from './sections/TransformDemo.vue'
import NormalizerDemo from './sections/NormalizerDemo.vue'
import FetchDemo from './sections/FetchDemo.vue'
import BoundaryDemo from './sections/BoundaryDemo.vue'
import CallbacksDemo from './sections/CallbacksDemo.vue'
import DebugDemo from './sections/DebugDemo.vue'
import MergeRegistriesDemo from './sections/MergeRegistriesDemo.vue'
import RoutingStrategyDemo from './sections/RoutingStrategyDemo.vue'

type TabId =
  | 'toast' | 'modal' | 'inline' | 'silent' | 'fallback'
  | 'dedupe' | 'concurrent' | 'transform' | 'normalizer'
  | 'fetch' | 'boundary' | 'callbacks' | 'debug'
  | 'merge' | 'routing'

interface Tab {
  id: TabId
  label: string
  badge?: string
  badgeColor?: string
}

const tabs: Tab[] = [
  { id: 'toast', label: 'Toast', badge: 'toast', badgeColor: 'var(--accent-yellow)' },
  { id: 'modal', label: 'Modal', badge: 'modal', badgeColor: 'var(--accent-purple)' },
  { id: 'inline', label: 'Inline', badge: 'inline', badgeColor: 'var(--accent-cyan)' },
  { id: 'silent', label: 'Silent', badge: 'silent', badgeColor: 'var(--text-muted)' },
  { id: 'fallback', label: 'Fallback', badge: 'cfg', badgeColor: 'var(--accent-orange)' },
  { id: 'dedupe', label: 'Dedupe', badge: 'cfg', badgeColor: 'var(--accent-blue)' },
  { id: 'concurrent', label: 'Concurrent', badge: 'cfg', badgeColor: 'var(--accent-pink)' },
  { id: 'transform', label: 'Transform', badge: 'fn', badgeColor: 'var(--accent-green)' },
  { id: 'normalizer', label: 'Normalizer', badge: 'fn', badgeColor: 'var(--accent-cyan)' },
  { id: 'routing', label: 'Routing', badge: 'fn', badgeColor: 'var(--accent-cyan)' },
  { id: 'fetch', label: 'createFetch', badge: 'api', badgeColor: 'var(--accent-blue)' },
  { id: 'merge', label: 'mergeReg', badge: 'api', badgeColor: 'var(--accent-purple)' },
  { id: 'boundary', label: 'Boundary', badge: 'vue', badgeColor: 'var(--accent-green)' },
  { id: 'callbacks', label: 'Callbacks', badge: 'vue', badgeColor: 'var(--accent-green)' },
  { id: 'debug', label: 'Debug', badge: 'cfg', badgeColor: 'var(--accent-orange)' },
]

const activeTab = ref<TabId>('toast')
</script>

<template>
  <div style="display: flex; min-height: 100vh; flex-direction: column;">

    <!-- Header -->
    <header style="
      background: var(--bg-void);
      border-bottom: 1px solid var(--border-dim);
      padding: 0 24px;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 100;
    ">
      <div style="display: flex; align-items: center; height: 52px; gap: 20px;">
        <!-- Logo -->
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
          <div style="
            width: 28px; height: 28px;
            background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
            border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px;
          ">⚡</div>
          <div>
            <div style="font-family: 'Syne', sans-serif; font-weight: 800; font-size: 14px; color: var(--text-white); letter-spacing: -0.02em;">
              gracefulerrors
            </div>
            <div style="font-size: 9px; color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-top: -1px;">
              Vue Demo
            </div>
          </div>
        </div>

        <div style="width: 1px; height: 24px; background: var(--border-dim); flex-shrink: 0;" />

        <!-- Tabs -->
        <div style="display: flex; overflow-x: auto; flex: 1; scrollbar-width: none; -ms-overflow-style: none;">
          <div style="display: flex; gap: 0;">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="nav-tab"
              :class="{ active: activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <span v-if="tab.badge" :style="{
                display: 'inline-block',
                padding: '1px 4px',
                borderRadius: '2px',
                fontSize: '8px',
                fontWeight: '700',
                letterSpacing: '0.06em',
                background: `${tab.badgeColor}18`,
                color: tab.badgeColor,
                marginLeft: '4px',
                border: `1px solid ${tab.badgeColor}28`,
              }">{{ tab.badge }}</span>
            </button>
          </div>
        </div>

        <!-- Version badge -->
        <div style="flex-shrink: 0; font-size: 10px; color: var(--text-muted); font-family: 'JetBrains Mono', monospace;">
          v0.1.2
        </div>
      </div>
    </header>

    <!-- Main layout -->
    <div style="display: flex; flex: 1; overflow: hidden;">

      <!-- Content area -->
      <main style="flex: 1; overflow-y: auto; min-width: 0;">
        <div style="max-width: 900px; margin: 0 auto; padding: 24px 24px 48px;">

          <!-- Section header -->
          <div style="margin-bottom: 20px;">
            <div style="font-size: 10px; color: var(--text-muted); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace;">
              gracefulerrors / vue SDK — interactive playground
            </div>
            <div style="height: 1px; background: linear-gradient(90deg, var(--border-mid), transparent);" />
          </div>

          <!-- Active section -->
          <Transition
            name="tab-fade"
            mode="out-in"
          >
            <div :key="activeTab">
              <ToastDemo v-if="activeTab === 'toast'" />
              <ModalDemo v-else-if="activeTab === 'modal'" />
              <InlineDemo v-else-if="activeTab === 'inline'" />
              <SilentDemo v-else-if="activeTab === 'silent'" />
              <FallbackDemo v-else-if="activeTab === 'fallback'" />
              <DedupeDemo v-else-if="activeTab === 'dedupe'" />
              <MaxConcurrentDemo v-else-if="activeTab === 'concurrent'" />
              <TransformDemo v-else-if="activeTab === 'transform'" />
              <NormalizerDemo v-else-if="activeTab === 'normalizer'" />
              <RoutingStrategyDemo v-else-if="activeTab === 'routing'" />
              <FetchDemo v-else-if="activeTab === 'fetch'" />
              <MergeRegistriesDemo v-else-if="activeTab === 'merge'" />
              <BoundaryDemo v-else-if="activeTab === 'boundary'" />
              <CallbacksDemo v-else-if="activeTab === 'callbacks'" />
              <DebugDemo v-else-if="activeTab === 'debug'" />
            </div>
          </Transition>

          <!-- Footer info -->
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border-dim);">
            <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 10px; color: var(--text-muted);">
              <span>
                <span style="color: var(--accent-green);">✓</span>
                All features use the real <code style="color: var(--text-dim);">gracefulerrors</code> library
              </span>
              <span>
                <span style="color: var(--accent-blue);">⌘</span>
                Event log tracks all <code style="color: var(--text-dim);">engine.subscribe()</code> events
              </span>
              <span>
                <span style="color: var(--accent-yellow);">⚡</span>
                Renderer is a custom Vue <code style="color: var(--text-dim);">RendererAdapter</code>
              </span>
            </div>
          </div>
        </div>
      </main>

      <!-- Event log sidebar -->
      <EventLog />
    </div>

    <!-- Overlays -->
    <ToastContainer />
    <ModalContainer />
  </div>
</template>

<style>
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
