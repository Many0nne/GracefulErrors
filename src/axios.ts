import type { ErrorEngine } from './types'

// Structural type — avoids importing axios at runtime.
// Matches the AxiosInstance.interceptors.response shape.
interface AxiosResponseInterceptorManager {
  use(
    onFulfilled: null | undefined,
    onRejected: (error: unknown) => unknown
  ): number
  eject(id: number): void
}

export interface AxiosLike {
  interceptors: {
    response: AxiosResponseInterceptorManager
  }
}

/**
 * Installs a response interceptor on an Axios instance that forwards errors
 * to a GracefulErrors engine.
 *
 * Modes:
 * - `throw`  (default) — forward to engine, then re-throw the original error
 * - `handle`           — forward to engine, then swallow (resolves undefined)
 * - `silent`           — pass-through without notifying the engine
 *
 * Returns an unsubscribe function that ejects the interceptor.
 */
export function createAxiosInterceptor(
  axiosInstance: AxiosLike,
  engine: ErrorEngine,
  options: { mode?: 'throw' | 'handle' | 'silent' } = {}
): () => void {
  const mode = options.mode ?? 'throw'

  const id = axiosInstance.interceptors.response.use(null, (error: unknown) => {
    if (mode === 'silent') return Promise.reject(error)

    engine.handle(error)

    if (mode === 'handle') return Promise.resolve(undefined)

    // mode === 'throw'
    return Promise.reject(error)
  })

  return () => axiosInstance.interceptors.response.eject(id)
}
