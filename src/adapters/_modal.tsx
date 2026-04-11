import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import type { RendererAdapter, RenderIntent } from "../types";
import { resolveMessage } from "../registry";

// ---------------------------------------------------------------------------
// Modal component
// ---------------------------------------------------------------------------

export function ModalDialog({
  message,
  dismissible,
  onDismiss,
}: {
  readonly message: string;
  readonly dismissible: boolean;
  readonly onDismiss: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      {dismissible && (
        <button
          style={{
            position: "absolute",
            inset: 0,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Dismiss modal overlay"
          onClick={onDismiss}
        />
      )}
      <div
        style={{
          background: "white",
          borderRadius: 8,
          padding: 24,
          minWidth: 300,
          maxWidth: 500,
          position: "relative",
        }}
      >
        <p style={{ margin: "0 0 16px" }}>{message}</p>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal manager
// ---------------------------------------------------------------------------

type ModalEntry = {
  root: ReturnType<typeof createRoot>;
  container: HTMLDivElement;
};

export function createModalManager() {
  const activeModalRoots = new Map<string, ModalEntry>();

  function renderModal(
    key: string,
    message: string,
    dismissible: boolean,
    onDismiss?: () => void,
  ): void {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    activeModalRoots.set(key, { root, container });

    const dismiss = () => {
      activeModalRoots.delete(key);
      root.unmount();
      if (document.body.contains(container)) {
        container.remove();
      }
      onDismiss?.();
    };

    root.render(
      <ModalDialog
        message={message}
        dismissible={dismissible}
        onDismiss={dismiss}
      />,
    );
  }

  function clearModal(code: string): void {
    const modal = activeModalRoots.get(code);
    if (modal !== undefined) {
      modal.root.unmount();
      if (document.body.contains(modal.container)) modal.container.remove();
      activeModalRoots.delete(code);
    }
  }

  function clearAllModals(): void {
    for (const { root, container } of activeModalRoots.values()) {
      root.unmount();
      if (document.body.contains(container)) container.remove();
    }
    activeModalRoots.clear();
  }

  return { renderModal, clearModal, clearAllModals };
}

// ---------------------------------------------------------------------------
// Base adapter factory
// ---------------------------------------------------------------------------

export function createBaseAdapter<TId>(
  renderToast: (intent: RenderIntent) => TId,
  dismissToast: (id: TId) => void,
  dismissAllToasts: () => void,
): RendererAdapter {
  const activeToastIds = new Map<string, TId>();
  const { renderModal, clearModal, clearAllModals } = createModalManager();

  function render<TCode extends string = string>(
    intent: RenderIntent<TCode>,
    lifecycle: { onDismiss?: () => void },
  ): void {
    switch (intent.ui) {
      case "toast": {
        const id = renderToast(intent as unknown as RenderIntent<string>);
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
      dismissToast(id);
      activeToastIds.delete(code);
    }
    clearModal(code);
  }

  function clearAll(): void {
    dismissAllToasts();
    activeToastIds.clear();
    clearAllModals();
  }

  return { render, clear, clearAll };
}
