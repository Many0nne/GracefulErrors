"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ErrorEngine, AppError, StateListener } from "./types";

export const ErrorEngineContext = createContext<{ engine: ErrorEngine } | null>(
  null,
);

export function ErrorEngineProvider<TCode extends string = string>({
  engine,
  children,
}: {
  readonly engine: ErrorEngine<TCode>;
  readonly children: React.ReactNode;
}): JSX.Element {
  const contextValue = useMemo(() => ({ engine }), [engine]);

  useEffect(() => {
    return () => {
      engine.destroy();
    };
  }, [engine]);

  return (
    <ErrorEngineContext.Provider value={contextValue}>
      {children}
    </ErrorEngineContext.Provider>
  );
}

export function useErrorEngine<
  TCode extends string = string,
>(): ErrorEngine<TCode> | null {
  const ctx = useContext(ErrorEngineContext);
  if (!ctx) {
    if (process.env["NODE_ENV"] === "development") {
      console.error(
        "[gracefulerrors] useErrorEngine called outside of ErrorEngineProvider.",
      );
    }
    return null;
  }
  return ctx.engine as ErrorEngine<TCode>;
}

export function useFieldError<TField extends string = string>(
  field: TField,
): { error: AppError<string, TField> | null } {
  const engine = useErrorEngine();
  const [error, setError] = useState<AppError<string, TField> | null>(null);

  useEffect(() => {
    if (!engine) return;

    const unsubscribe = engine.subscribe(
      (event: Parameters<StateListener>[0]) => {
        if (event.type === "ERROR_ADDED" && event.action === "inline") {
          if (event.error.context?.field === field) {
            setError(event.error as AppError<string, TField>);
          }
        } else if (event.type === "ERROR_CLEARED") {
          setError((prev) => (prev?.code === event.code ? null : prev));
        } else if (event.type === "ALL_CLEARED") {
          setError(null);
        }
      },
    );

    return unsubscribe;
  }, [engine, field]);

  return { error };
}

export class ErrorBoundaryWithEngine extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  static readonly contextType = ErrorEngineContext;
  declare context: React.ContextType<typeof ErrorEngineContext>;

  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.context?.engine?.handle(error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
