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
      // Override the 401 preset: dismissible modal
      HTTP_401: {
        ui: "modal",
        message: "Your session has expired. Please log in again.",
        uiOptions: { dismissible: true },
      },
    }),
    {
      NETWORK_ERROR: {
        ui: "toast",
        message: "Network error. Check your connection and try again.",
        uiOptions: { severity: "error" },
      },
    },
  ),
  renderer: createSonnerAdapter(),
  history: { enabled: true, maxEntries: 50 },
});
