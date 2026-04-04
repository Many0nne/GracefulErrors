import type { AppError, ErrorSlot, ErrorStateManager, StateListener, UIAction } from './types'

export interface StateManagerConfig<TCode extends string> {
  maxConcurrent?: number   // default: 3
  maxQueue?: number        // default: unbounded
  dedupeWindow?: number    // ms, default: 300
  onDropped?: (error: AppError<TCode>, reason: 'dedupe' | 'ttl_expired' | 'queue_overflow') => void
}

export function createStateManager<TCode extends string>(
  config: StateManagerConfig<TCode>
): ErrorStateManager<TCode> {
  const maxConcurrent = config.maxConcurrent ?? 3
  const maxQueue = config.maxQueue
  const dedupeWindow = config.dedupeWindow ?? 300
  const { onDropped } = config

  type InternalSlot = ErrorSlot<TCode> & { ttl?: number; _pendingAction?: UIAction }

  const activeSlots = new Map<string, InternalSlot>()
  const queue: InternalSlot[] = []
  const dedupeMap = new Map<string, number>()
  const ttlTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const listeners = new Set<StateListener<TCode>>()

  function notify(event: Parameters<StateListener<TCode>>[0]): void {
    for (const listener of listeners) {
      try {
        listener(event)
      } catch (err) {
        if (process.env['NODE_ENV'] !== 'production') {
          console.error('[gracefulerrors] StateManager listener threw:', err)
        }
      }
    }
  }

  function promoteFromQueue(): void {
    if (queue.length > 0 && activeSlots.size < maxConcurrent) {
      const next = queue.shift()!
      activateSlot(next, next._pendingAction as UIAction)
    }
  }

  function activateSlot(slot: InternalSlot, action: UIAction): void {
    slot.state = 'ACTIVE'
    activeSlots.set(slot.fingerprint, slot)

    // Start TTL timer if configured
    const ttl = slot.ttl
    if (ttl != null && ttl > 0) {
      const timer = setTimeout(() => {
        if (activeSlots.has(slot.fingerprint)) {
          activeSlots.delete(slot.fingerprint)
          ttlTimers.delete(slot.fingerprint)
          onDropped?.(slot.error, 'ttl_expired')
          promoteFromQueue()
        }
      }, ttl)
      ttlTimers.set(slot.fingerprint, timer)
    }

    notify({ type: 'ERROR_ADDED', error: slot.error, action })
  }

  function canHandle(fingerprint: string): boolean {
    const lastSeen = dedupeMap.get(fingerprint)
    if (lastSeen === undefined) return true
    return Date.now() - lastSeen >= dedupeWindow
  }

  function enqueue(slot: InternalSlot): 'active' | 'queued' | 'rejected' {
    if (!canHandle(slot.fingerprint)) {
      onDropped?.(slot.error, 'dedupe')
      return 'rejected'
    }

    dedupeMap.set(slot.fingerprint, Date.now())

    if (activeSlots.size < maxConcurrent) {
      activateSlot(slot, slot._pendingAction as UIAction)
      return 'active'
    }

    if (maxQueue !== undefined && queue.length >= maxQueue) {
      onDropped?.(slot.error, 'queue_overflow')
      return 'rejected'
    }

    slot.state = 'QUEUED'
    queue.push(slot)
    return 'queued'
  }

  function release(code: TCode): void {
    // Check active slots first
    let targetFingerprint: string | undefined

    for (const [fingerprint, slot] of activeSlots) {
      if (slot.error.code === code) {
        targetFingerprint = fingerprint
        break
      }
    }

    if (targetFingerprint !== undefined) {
      const slot = activeSlots.get(targetFingerprint)!
      slot.state = 'EXPIRED'
      activeSlots.delete(targetFingerprint)

      const timer = ttlTimers.get(targetFingerprint)
      if (timer !== undefined) {
        clearTimeout(timer)
        ttlTimers.delete(targetFingerprint)
      }

      notify({ type: 'ERROR_CLEARED', code })
      promoteFromQueue()
      return
    }

    // Check queue â€” spec: QUEUED | clear() â†’ EXPIRED | remove from queue
    const queueIdx = queue.findIndex((slot) => slot.error.code === code)
    if (queueIdx !== -1) {
      const slot = queue[queueIdx]!
      slot.state = 'EXPIRED'
      queue.splice(queueIdx, 1)
      notify({ type: 'ERROR_CLEARED', code })
    }
  }

  function getActiveSlots(): ErrorSlot<TCode>[] {
    return Array.from(activeSlots.values())
  }

  function getQueueLength(): number {
    return queue.length
  }

  function clearAll(): void {
    for (const timer of ttlTimers.values()) {
      clearTimeout(timer)
    }
    ttlTimers.clear()
    activeSlots.clear()
    queue.length = 0
    notify({ type: 'ALL_CLEARED' })
  }

  function subscribe(listener: StateListener<TCode>): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }

  return { canHandle, enqueue, release, getActiveSlots, getQueueLength, clearAll, subscribe }
}

export type { ErrorStateManager, StateListener }
