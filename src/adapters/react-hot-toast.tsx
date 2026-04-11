import toast from "react-hot-toast";
import type { RendererAdapter, RenderIntent } from "../types";
import { resolveMessage } from "../registry";
import { createModalManager } from "./_modal";

export function createHotToastAdapter(): RendererAdapter {
  const activeToastIds = new Map<string, string>();
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
          severity?: "info" | "warning" | "error" | "success";
          icon?: string;
          duration?: number;
        };
        const opts = (intent.entry.uiOptions ?? {}) as ToastOpts;
        const severity = opts.severity ?? "error";

        let id: string;
        if (severity === "error") {
          id = toast.error(message, {
            icon: opts.icon,
            duration: opts.duration ?? 4000,
          });
        } else if (severity === "success") {
          id = toast.success(message, {
            icon: opts.icon,
            duration: opts.duration ?? 4000,
          });
        } else {
          // warning / info → generic toast with custom icon
          const defaultIcon = severity === "warning" ? "⚠️" : "ℹ️";
          id = toast(message, {
            icon: opts.icon ?? defaultIcon,
            duration: opts.duration ?? 4000,
          });
        }

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

export { Toaster as HotToaster } from "react-hot-toast";
