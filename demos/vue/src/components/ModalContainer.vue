<script setup lang="ts">
import { modal } from '../renderer'

function dismiss() {
  if (modal.active?.dismissible) {
    modal.active.onDismiss()
  }
}

const sizeMap = {
  sm: '380px',
  md: '520px',
  lg: '680px',
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modal.active"
      style="
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.75);
        backdrop-filter: blur(4px);
        padding: 24px;
      "
      @click.self="dismiss"
    >
      <div
        class="modal-enter"
        :style="{
          width: '100%',
          maxWidth: sizeMap[modal.active.size],
          background: '#141420',
          border: '1px solid #2a2a4a',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
        }"
      >
        <!-- Header -->
        <div style="
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1e1e35;
          background: rgba(255, 68, 102, 0.04);
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 28px;
              height: 28px;
              border-radius: 6px;
              background: rgba(255, 68, 102, 0.15);
              border: 1px solid rgba(255, 68, 102, 0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
            ">⊗</div>
            <div>
              <div style="font-family: 'Syne', sans-serif; font-weight: 700; font-size: 15px; color: #f5f5ff;">
                {{ modal.active.title }}
              </div>
            </div>
          </div>
          <button
            v-if="modal.active.dismissible"
            @click="dismiss"
            style="
              background: transparent;
              border: 1px solid #2a2a4a;
              color: #7070aa;
              width: 28px;
              height: 28px;
              border-radius: 5px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              transition: all 0.15s;
              font-family: 'JetBrains Mono', monospace;
            "
            onmouseover="this.style.color='#e0e0f5';this.style.borderColor='#3d3d70'"
            onmouseout="this.style.color='#7070aa';this.style.borderColor='#2a2a4a'"
          >✕</button>
          <div v-else style="
            font-size: 10px;
            color: #ff4466;
            background: rgba(255,68,102,0.1);
            border: 1px solid rgba(255,68,102,0.2);
            padding: 3px 8px;
            border-radius: 3px;
            letter-spacing: 0.06em;
            font-family: 'JetBrains Mono', monospace;
          ">NON-DISMISSIBLE</div>
        </div>

        <!-- Body -->
        <div style="padding: 24px 20px;">
          <p style="
            margin: 0;
            font-family: 'JetBrains Mono', monospace;
            font-size: 13px;
            color: #b0b0d8;
            line-height: 1.7;
          ">{{ modal.active.message }}</p>
        </div>

        <!-- Footer -->
        <div style="
          padding: 14px 20px;
          border-top: 1px solid #1e1e35;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        ">
          <button
            v-if="modal.active.dismissible"
            @click="dismiss"
            class="btn btn-danger"
          >
            Dismiss
          </button>
          <button
            v-else
            @click="() => { modal.active && (modal.active.onDismiss()) }"
            class="btn btn-primary"
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
