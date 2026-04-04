<script setup lang="ts">
import { ref } from 'vue'
import { useFieldError } from 'gracefulerrors/vue'
import { engine } from '../engine'

const email = ref('')
const password = ref('')
const name = ref('')

const { error: emailError } = useFieldError('email')
const { error: passwordError } = useFieldError('password')
const { error: nameError } = useFieldError('name')

function triggerEmailError() {
  engine.handle({ code: 'FORM_VALIDATION_EMAIL', context: { field: 'email' } })
}
function triggerPasswordError() {
  engine.handle({ code: 'FORM_VALIDATION_MIN_LENGTH', context: { field: 'password', min: 12 } })
}
function triggerNameError() {
  engine.handle({ code: 'FORM_VALIDATION_REQUIRED', context: { field: 'name' } })
}
function clearAll() {
  engine.clearAll()
  email.value = ''
  password.value = ''
  name.value = ''
}

function handleSubmit() {
  engine.clearAll()
  let hasError = false
  if (!email.value || !email.value.includes('@')) {
    engine.handle({ code: 'FORM_VALIDATION_EMAIL', context: { field: 'email' } })
    hasError = true
  }
  if (!password.value || password.value.length < 8) {
    engine.handle({ code: 'FORM_VALIDATION_MIN_LENGTH', context: { field: 'password', min: 8 } })
    hasError = true
  }
  if (!name.value.trim()) {
    engine.handle({ code: 'FORM_VALIDATION_REQUIRED', context: { field: 'name' } })
    hasError = true
  }
  if (!hasError) {
    engine.handle({ code: 'ORDER_FAILED' })
  }
}
</script>

<template>
  <div class="card" style="padding: 20px;">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
      <div class="accent-line" style="background: var(--accent-cyan);" />
      <h2 class="section-title">Inline Field Errors</h2>
      <span class="badge badge-cyan">ui: 'inline'</span>
    </div>
    <p style="color: var(--text-dim); font-size: 12px; margin: 0 0 16px; line-height: 1.6;">
      <code style="color: var(--accent-cyan); font-size: 11px;">useFieldError(field)</code> subscribes to inline errors for a specific field.
      Errors routed as <code style="color: var(--accent-cyan); font-size: 11px;">'inline'</code> with a matching <code style="color: var(--accent-cyan); font-size: 11px;">context.field</code> are surfaced reactively.
    </p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 600px;">
      <!-- Name -->
      <div style="grid-column: 1 / -1;">
        <label style="display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 5px; letter-spacing: 0.04em;">
          FULL NAME
        </label>
        <input
          v-model="name"
          class="input"
          :class="{ 'error-field': nameError }"
          placeholder="Your name..."
        />
        <div v-if="nameError" style="margin-top: 4px; font-size: 11px; color: var(--accent-red); display: flex; align-items: center; gap: 4px;">
          <span>⊗</span> {{ nameError.message }}
        </div>
      </div>

      <!-- Email -->
      <div>
        <label style="display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 5px; letter-spacing: 0.04em;">
          EMAIL
        </label>
        <input
          v-model="email"
          class="input"
          :class="{ 'error-field': emailError }"
          placeholder="user@example.com"
          type="email"
        />
        <div v-if="emailError" style="margin-top: 4px; font-size: 11px; color: var(--accent-red); display: flex; align-items: center; gap: 4px;">
          <span>⊗</span> {{ emailError.message }}
        </div>
      </div>

      <!-- Password -->
      <div>
        <label style="display: block; font-size: 11px; color: var(--text-dim); margin-bottom: 5px; letter-spacing: 0.04em;">
          PASSWORD
        </label>
        <input
          v-model="password"
          class="input"
          :class="{ 'error-field': passwordError }"
          placeholder="Min 8 chars..."
          type="password"
        />
        <div v-if="passwordError" style="margin-top: 4px; font-size: 11px; color: var(--accent-red); display: flex; align-items: center; gap: 4px;">
          <span>⊗</span> {{ passwordError.message }}
        </div>
      </div>
    </div>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px;">
      <button class="btn btn-primary" @click="handleSubmit">Submit form (validates all)</button>
      <button class="btn btn-danger" @click="triggerEmailError">Email error only</button>
      <button class="btn btn-warning" @click="triggerPasswordError">Password error only</button>
      <button class="btn btn-ghost" @click="triggerNameError">Name required error</button>
      <button class="btn btn-ghost" @click="clearAll">Clear all</button>
    </div>

    <div style="margin-top: 14px;" class="code-block">const { error } = useFieldError('email')
// error.value → AppError | null</div>
  </div>
</template>
