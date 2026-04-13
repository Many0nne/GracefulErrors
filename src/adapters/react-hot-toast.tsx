import toast from "react-hot-toast";
import type { RendererAdapter, RenderIntent } from "../types";
import { resolveMessage } from "../registry";
import { createBaseAdapter } from "./_modal";

export function createHotToastAdapter(): RendererAdapter {
  return createBaseAdapter<string>(
    (intent: RenderIntent) => {
      const message =
        resolveMessage(intent.entry, intent.error, intent.messageResolver) ??
        intent.error.message ??
        "An error occurred";

      type ToastOpts = {
        severity?: "info" | "warning" | "error" | "success";
        icon?: string;
        duration?: number;
      };
      const opts = (intent.entry.uiOptions ?? {}) as ToastOpts;
      const severity = opts.severity ?? "error";

      if (severity === "error") {
        return toast.error(message, {
          icon: opts.icon,
          duration: opts.duration ?? 4000,
        });
      }
      if (severity === "success") {
        return toast.success(message, {
          icon: opts.icon,
          duration: opts.duration ?? 4000,
        });
      }
      // warning / info → generic toast with custom icon
      const defaultIcon = severity === "warning" ? "⚠️" : "ℹ️";
      return toast(message, {
        icon: opts.icon ?? defaultIcon,
        duration: opts.duration ?? 4000,
      });
    },
    (id) => toast.dismiss(id),
    () => toast.dismiss(),
  );
}

export { Toaster as HotToaster } from "react-hot-toast";
