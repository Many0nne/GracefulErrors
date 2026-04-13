import { toast } from "sonner";
import type { RendererAdapter, RenderIntent } from "../types";
import { resolveMessage } from "../registry";
import { createBaseAdapter } from "./_modal";

export function createSonnerAdapter(): RendererAdapter {
  return createBaseAdapter<string | number>(
    (intent: RenderIntent) => {
      const message =
        resolveMessage(intent.entry, intent.error, intent.messageResolver) ??
        intent.error.message ??
        "An error occurred";

      type ToastOpts = {
        position?:
          | "top-left"
          | "top-right"
          | "bottom-left"
          | "bottom-right"
          | "top-center"
          | "bottom-center";
        severity?: "info" | "warning" | "error" | "success";
        icon?: string;
        duration?: number;
      };
      const opts = (intent.entry.uiOptions ?? {}) as ToastOpts;
      const severity = opts.severity ?? "error";

      type Severity = NonNullable<ToastOpts["severity"]>;
      const severityMap: Record<Severity, typeof toast.error> = {
        error: toast.error,
        warning: toast.warning,
        info: toast.info,
        success: toast.success,
      };
      const toastFn = severityMap[severity] ?? toast.error;

      return toastFn(message, {
        position: opts.position ?? "top-right",
        icon: opts.icon,
        duration: opts.duration ?? 4000,
      });
    },
    (id) => toast.dismiss(id),
    () => toast.dismiss(),
  );
}

export { Toaster as SonnerToaster } from "sonner";
