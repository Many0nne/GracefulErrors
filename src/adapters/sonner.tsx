import { toast } from "sonner";
import type { RendererAdapter, RenderIntent } from "../types";
import { resolveMessage } from "../registry";
import { createModalManager } from "./_modal";

export function createSonnerAdapter(): RendererAdapter {
  const activeToastIds = new Map<string, string | number>();
  const { renderModal, clearModal, clearAllModals } = createModalManager();

  function render<TCode extends string = string>(
    intent: RenderIntent<TCode>,
    lifecycle: { onDismiss?: () => void },
  ): void {
    switch (intent.ui) {
      case "toast": {
        const message =
          resolveMessage(intent.entry, intent.error) ??
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

        const id = toastFn(message, {
          position: opts.position ?? "top-right",
          icon: opts.icon,
          duration: opts.duration ?? 4000,
        });

        activeToastIds.set(intent.error.code as string, id);
        break;
      }

      case "modal": {
        const message =
          resolveMessage(intent.entry, intent.error) ??
          intent.error.message ??
          "An error occurred";
        const opts = intent.entry.uiOptions ?? {};
        const dismissible =
          (opts as { dismissible?: boolean }).dismissible !== false;

        renderModal(
          intent.error.code as string,
          message,
          dismissible,
          lifecycle.onDismiss,
        );
        break;
      }

      case "inline":
        return;

      case "silent":
        return;
    }
  }

  function clear(code: string): void {
    const id = activeToastIds.get(code);
    if (id !== undefined) {
      toast.dismiss(id);
      activeToastIds.delete(code);
    }
    clearModal(code);
  }

  function clearAll(): void {
    toast.dismiss();
    activeToastIds.clear();
    clearAllModals();
  }

  return { render, clear, clearAll };
}

export { Toaster as SonnerToaster } from "sonner";
