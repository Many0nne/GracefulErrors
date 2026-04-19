import React from "react";
import ReactDOM from "react-dom/client";
import { ErrorEngineProvider } from "gracefulerrors/react";
import { SonnerToaster } from "gracefulerrors/sonner";
import { engine } from "./engine";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* Mount SonnerToaster once at the app root so toasts can render */}
    <SonnerToaster richColors position="top-right" />

    {/* Provide the engine to the entire component tree */}
    <ErrorEngineProvider engine={engine}>
      <App />
    </ErrorEngineProvider>
  </React.StrictMode>,
);
