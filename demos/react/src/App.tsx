import { useState, useEffect } from 'react'
import { ErrorEngineProvider } from 'gracefulerrors/react'
import { SonnerToaster } from 'gracefulerrors/sonner'
import { engine, lifecycleLogs, logSubscribers, type LogEntry } from './engine'

import ToastDemo from './sections/ToastDemo'
import ModalDemo from './sections/ModalDemo'
import InlineDemo from './sections/InlineDemo'
import SilentDemo from './sections/SilentDemo'
import FallbackDemo from './sections/FallbackDemo'
import DedupeDemo from './sections/DedupeDemo'
import MaxConcurrentDemo from './sections/MaxConcurrentDemo'
import TransformDemo from './sections/TransformDemo'
import NormalizerDemo from './sections/NormalizerDemo'
import FetchDemo from './sections/FetchDemo'
import BoundaryDemo from './sections/BoundaryDemo'
import CallbacksDemo from './sections/CallbacksDemo'
import DebugDemo from './sections/DebugDemo'

// ---------------------------------------------------------------------------
// Log type colors
// ---------------------------------------------------------------------------
const LOG_COLORS: Record<string, string> = {
  onError:       'text-red-400',
  onNormalized:  'text-yellow-300',
  onRouted:      'text-green-400',
  onSuppressed:  'text-purple-400',
  onFallback:    'text-orange-400',
  onDropped:     'text-red-500',
  ERROR_ADDED:   'text-sky-400',
  ERROR_CLEARED: 'text-slate-400',
  ALL_CLEARED:   'text-slate-500',
}

function LogBadge({ type }: { type: string }) {
  const color = LOG_COLORS[type] ?? 'text-slate-400'
  return (
    <span className={`font-mono text-xs font-semibold ${color}`}>{type}</span>
  )
}

function LogPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <aside className="w-80 min-w-[280px] bg-slate-900 border-l border-slate-700 flex flex-col h-screen sticky top-0">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold text-sm tracking-wide">Live Event Log</h2>
          <p className="text-slate-400 text-xs mt-0.5">engine.subscribe() + lifecycle hooks</p>
        </div>
        <button
          onClick={() => engine.clearAll()}
          className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors"
        >
          Clear all
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {logs.length === 0 && (
          <p className="text-slate-600 text-xs text-center mt-8">No events yet.<br/>Trigger an error to see logs.</p>
        )}
        {logs.map(log => (
          <div key={log.id} className="bg-slate-800 rounded px-3 py-2 text-xs border border-slate-700/50">
            <div className="flex items-center justify-between gap-2 mb-1">
              <LogBadge type={log.type} />
              <span className="text-slate-600 font-mono">{log.timestamp}</span>
            </div>
            {log.code && (
              <div className="text-slate-300 font-mono">
                <span className="text-slate-500">code: </span>{log.code}
              </div>
            )}
            {log.action && (
              <div className="text-slate-300 font-mono">
                <span className="text-slate-500">action: </span>
                <span className="text-emerald-400">{log.action}</span>
              </div>
            )}
            {log.reason && (
              <div className="text-slate-400 font-mono truncate">
                <span className="text-slate-500">reason: </span>{log.reason}
              </div>
            )}
            {log.detail && (
              <div className="text-slate-400 truncate">
                <span className="text-slate-500">detail: </span>{log.detail}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-4 py-2 border-t border-slate-700">
        <p className="text-slate-600 text-xs">{logs.length} events (last 50 shown)</p>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const NAV_SECTIONS = [
  { id: 'toast',        label: 'Toast' },
  { id: 'modal',        label: 'Modal' },
  { id: 'inline',       label: 'Inline' },
  { id: 'silent',       label: 'Silent' },
  { id: 'fallback',     label: 'Fallback' },
  { id: 'dedupe',       label: 'Dedupe' },
  { id: 'maxconcurrent',label: 'Max Concurrent' },
  { id: 'transform',    label: 'Transform' },
  { id: 'normalizer',   label: 'Normalizer' },
  { id: 'fetch',        label: 'Fetch' },
  { id: 'boundary',     label: 'Error Boundary' },
  { id: 'callbacks',    label: 'Callbacks' },
  { id: 'debug',        label: 'Debug' },
]

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([...lifecycleLogs])

  useEffect(() => {
    const handler = (updated: LogEntry[]) => setLogs(updated)
    logSubscribers.push(handler)
    return () => {
      const idx = logSubscribers.indexOf(handler)
      if (idx !== -1) logSubscribers.splice(idx, 1)
    }
  }, [])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <ErrorEngineProvider engine={engine}>
      <SonnerToaster richColors closeButton />
      <div className="flex min-h-screen bg-slate-50">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
            <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
              <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-sm">
                GE
              </div>
              <div>
                <h1 className="text-slate-900 font-bold text-lg leading-none">GracefulErrors</h1>
                <p className="text-slate-500 text-xs mt-0.5">React SDK — Interactive Demo</p>
              </div>
              <nav className="ml-auto flex flex-wrap gap-1">
                {NAV_SECTIONS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className="text-xs text-slate-500 hover:text-sky-600 hover:bg-sky-50 px-2 py-1 rounded transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </nav>
            </div>
          </header>

          {/* Sections */}
          <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            <Section><div id="toast"><ToastDemo /></div></Section>
            <Section><div id="modal"><ModalDemo /></div></Section>
            <Section><div id="inline"><InlineDemo /></div></Section>
            <Section><div id="silent"><SilentDemo /></div></Section>
            <Section><div id="fallback"><FallbackDemo /></div></Section>
            <Section><div id="dedupe"><DedupeDemo /></div></Section>
            <Section><div id="maxconcurrent"><MaxConcurrentDemo /></div></Section>
            <Section><div id="transform"><TransformDemo /></div></Section>
            <Section><div id="normalizer"><NormalizerDemo /></div></Section>
            <Section><div id="fetch"><FetchDemo /></div></Section>
            <Section><div id="boundary"><BoundaryDemo /></div></Section>
            <Section><div id="callbacks"><CallbacksDemo /></div></Section>
            <Section><div id="debug"><DebugDemo /></div></Section>
          </main>

          <footer className="max-w-4xl mx-auto px-6 py-8 text-center text-slate-400 text-sm border-t border-slate-200 mt-4">
            GracefulErrors React Demo — All features demonstrated with real library API calls
          </footer>
        </div>

        {/* Sidebar log panel */}
        <LogPanel logs={logs} />
      </div>
    </ErrorEngineProvider>
  )
}
