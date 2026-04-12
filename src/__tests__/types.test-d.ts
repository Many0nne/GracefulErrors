import { expectType, expectAssignable } from "tsd";
import type {
  AppError,
  HandleResult,
  ErrorEngineConfig,
  RoutingStrategy,
  UIAction,
} from "../types";

// AppError without generics defaults to string for both TCode and TField
declare const appError: AppError;
expectAssignable<{
  code: string;
  context?: { field?: string; [key: string]: unknown };
}>(appError);

// HandleResult is a discriminated union on `handled`
declare const handledResult: Extract<HandleResult, { handled: true }>;
expectType<UIAction>(handledResult.uiAction);

declare const unhandledResult: Extract<HandleResult, { handled: false }>;
expectType<"suppressed" | "deduped" | "dropped">(unhandledResult.reason);

// ErrorEngineConfig.fallback.ui does not include 'inline'
type FallbackUI = NonNullable<ErrorEngineConfig["fallback"]>["ui"];
expectType<"toast" | "modal" | "silent">({} as FallbackUI);

// RoutingStrategy return type is UIAction | null
type StrategyReturn = ReturnType<RoutingStrategy>;
expectType<UIAction | null>({} as StrategyReturn);
