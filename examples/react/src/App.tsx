import { useMemo, useState } from "react";
import { createFetch } from "gracefulerrors";
import { useErrorEngine } from "gracefulerrors/react";

/**
 * Simulated API endpoints that always respond with specific HTTP errors.
 * Replace these with real endpoints in a production app.
 *
 * Local Vite dev-server routes return the requested status code without any
 * external dependency (avoids SSL/cert issues with third-party services).
 */
const ENDPOINTS: Record<string, string> = {
  "404 Not Found": "/api/error/404",
  "401 Unauthorized": "/api/error/401",
  "500 Server Error": "/api/error/500",
  "429 Rate Limited": "/api/error/429",
  "Network error": "https://localhost:0/unreachable", // will fail to connect
};

export default function App() {
  const engine = useErrorEngine();
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  /**
   * createFetch wraps native fetch and forwards non-OK responses + network
   * errors to the engine automatically.  mode: 'handle' swallows the throw so
   * we don't need a try/catch in the component.
   */
  const safeFetch = useMemo(
    () => (engine ? createFetch(engine, { mode: "handle" }) : null),
    [engine],
  );

  async function triggerError(label: string, url: string) {
    if (!safeFetch) return;
    setLoading(true);
    setLastResult(null);
    try {
      const res = await safeFetch(url);
      // safeFetch in 'handle' mode returns undefined when an error was handled
      setLastResult(
        res ? `OK — ${res.status}` : `Error handled for "${label}"`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 480,
        margin: "4rem auto",
        padding: "0 1rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        GracefulErrors — React example
      </h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        Click a button to trigger an HTTP error. The engine will route it to the
        right UI automatically (toast or modal).
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {Object.entries(ENDPOINTS).map(([label, url]) => (
          <button
            key={label}
            disabled={loading}
            onClick={() => triggerError(label, url)}
            style={{
              padding: "0.6rem 1.2rem",
              fontSize: "0.95rem",
              cursor: loading ? "not-allowed" : "pointer",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: loading ? "#f5f5f5" : "#fff",
            }}
          >
            Trigger {label}
          </button>
        ))}
      </div>

      {lastResult && (
        <p style={{ marginTop: "1.5rem", color: "#333", fontSize: "0.9rem" }}>
          Last result: <code>{lastResult}</code>
        </p>
      )}

      <hr style={{ margin: "2rem 0", borderColor: "#eee" }} />

      <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
        Error history
      </h2>
      <HistoryPanel engine={engine} />
    </div>
  );
}

function HistoryPanel({
  engine,
}: {
  engine: ReturnType<typeof useErrorEngine>;
}) {
  const [history, setHistory] = useState(() => engine?.getHistory() ?? []);

  return (
    <div>
      <button
        onClick={() => setHistory(engine?.getHistory() ?? [])}
        style={{
          marginBottom: "0.75rem",
          fontSize: "0.85rem",
          cursor: "pointer",
        }}
      >
        Refresh history
      </button>
      {history.length === 0 ? (
        <p style={{ color: "#888", fontSize: "0.9rem" }}>
          No errors recorded yet.
        </p>
      ) : (
        <ul
          style={{
            paddingLeft: "1.2rem",
            fontSize: "0.85rem",
            lineHeight: 1.6,
          }}
        >
          {history.map((entry, i) => (
            <li key={i}>
              <strong>{entry.error.code}</strong>
              {" — "}
              {entry.handled
                ? `shown as ${entry.uiAction}`
                : `suppressed (${entry.reason})`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
