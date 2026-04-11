import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

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

  const handleBackdropKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!dismissible) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDismiss();
    }
  };

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
      role={dismissible ? "button" : undefined}
      tabIndex={dismissible ? 0 : undefined}
      aria-label={dismissible ? "Dismiss modal overlay" : undefined}
      onClick={dismissible ? onDismiss : undefined}
      onKeyDown={dismissible ? handleBackdropKeyDown : undefined}
    >
      <div
        style={{
          background: "white",
          borderRadius: 8,
          padding: 24,
          minWidth: 300,
          maxWidth: 500,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: "0 0 16px" }}>{message}</p>
        <button onClick={onDismiss}>Dismiss</button>
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
