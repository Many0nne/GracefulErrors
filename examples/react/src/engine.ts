import {
  createErrorEngine,
  createHttpPreset,
  mergeRegistries,
} from "gracefulerrors";
import { createSonnerAdapter } from "gracefulerrors/sonner";

/**
 * Application-wide error engine.
 *
 * - HTTP preset covers 400/401/403/404/422/429/500/502/503/504 out of the box.
 * - mergeRegistries combines the preset with app-specific codes as a typed union.
 * - Sonner adapter renders toasts and modals automatically.
 */
export const engine = createErrorEngine({
  registry: mergeRegistries(
    createHttpPreset({
      // Override the 401 preset: show a dismissible modal instead of the default
      HTTP_401: {
        ui: "modal",
        message: "Your session has expired. Please log in again.",
        uiOptions: { dismissible: true },
      },
    }),
    {
      // Application-specific error codes
      NETWORK_ERROR: {
        ui: "toast",
        message: "Network error. Check your connection and try again.",
        uiOptions: { severity: "error" },
      },
    },
  ),
  renderer: createSonnerAdapter(),
  // Keep an error history for debugging (auto-disabled in production)
  history: { enabled: true, maxEntries: 50 },
});
